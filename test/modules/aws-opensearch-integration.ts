import { OpenSearch } from '@aws-sdk/client-opensearch';

import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  itDocs,
  runBegin,
  runCommit,
  runInstall,
  runQuery,
  runUninstall,
} from '../helpers';

const dbAlias = 'iasql';
const initialPassword = '123456aA@';
const secondPassword = 'newPa@ss123!';
jest.setTimeout(1500000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const region = defaultRegion();

const prefix = getPrefix();
let username: string, password: string;

const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';

const opensearchClient = new OpenSearch({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  region,
});

const getInstanceTypeOffering = async (availabilityZones: string[]) => {
  const instanceTypes = await opensearchClient.listInstanceTypeDetails({
    EngineVersion: 'OpenSearch_2.3',
  });
  return instanceTypes.InstanceTypeDetails?.filter(it => it.AdvancedSecurityEnabled && it.EncryptionEnabled);
};

describe('OpenSearch Integration Testing', () => {
  it('creates a new test db', done => {
    (async () => {
      try {
        const { user, password: pgPassword } = await iasql.connect(dbAlias, 'not-needed', 'not-needed');
        username = user;
        password = pgPassword;
        if (!username || !password) throw new Error('Did not fetch pg credentials');
        done();
      } catch (e) {
        done(e);
      }
    })();
  });

  it('installs the aws_account module', install(['aws_account']));

  it(
    'inserts aws credentials',
    query(
      `
          INSERT INTO aws_credentials (access_key_id, secret_access_key)
          VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
      `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('starts a transaction', begin());

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
          UPDATE aws_regions
          SET is_default = TRUE
          WHERE region = '${region}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs('installs the opensearch module', install(['aws_opensearch']));

  it('starts a transaction', begin());
  itDocs(
    'adds a new domain',
    query(
      `
          INSERT INTO domain (domain_name, version,
                              availability_zone_count, instance_type, instance_count, ebs_options,
                              enable_fine_grained_access_control, fine_grained_access_control_master_username,
                              fine_grained_access_control_master_password, access_policy, region)
          VALUES ('${prefix}', 'OpenSearch_2.3', 1, 'c5.large.search', 1,
                  '{"Iops": 3000, "EBSEnabled": true, "Throughput": 125, "VolumeSize": 10, "VolumeType": "gp3"}', true,
                  'admin', '${initialPassword}',
                  '{"Version": "2012-10-17", "Statement": [{"Action": "es:*", "Effect": "Allow", "Resource": "*", "Principal": {"AWS": "*"}}]}',
                  '${region}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies creation of the domain and waits for the creation', commit());

  itDocs(
    'gets the domain and fetches it using the username and password',
    query(
      `
    SELECT endpoint FROM domain WHERE domain_name = '${prefix}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);

        const headers: Record<string, string> = {};
        headers.Authorization = 'Basic ' + Buffer.from('admin:' + initialPassword).toString('base64');
        fetch('https://' + res[0].endpoint, {
          method: 'GET',
          headers,
        })
          .then((r: any) => r.json())
          .then((r: any) => expect(r.version.number).toBe('2.3.0'));

        // should not respond with wrong password
        headers.Authorization = 'Basic ' + Buffer.from('admin:wrongpass').toString('base64');
        fetch('https://' + res[0].endpoint, {
          method: 'GET',
          headers,
        })
          .then((r: any) => r.text())
          .then((r: string) => expect(r).toBe('Unauthorized'));
      },
    ),
  );

  it('starts a transaction', begin());
  itDocs(
    'changes the password of the domain',
    query(
      `
          UPDATE domain
          SET fine_grained_access_control_master_username = 'admin',
              fine_grained_access_control_master_password = '${secondPassword}'
          WHERE domain_name = '${prefix}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies change of the password for the domain', commit());

  it(
    'fetches the domain using the second password',
    query(
      `
    SELECT endpoint FROM domain WHERE domain_name = '${prefix}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);

        const headers: Record<string, string> = {};
        headers.Authorization = 'Basic ' + Buffer.from('admin:' + secondPassword).toString('base64');
        fetch('https://' + res[0].endpoint, {
          method: 'GET',
          headers,
        })
          .then((r: any) => r.json())
          .then((r: any) => expect(r.version.number).toBe('2.3.0'));
      },
    ),
  );

  it('uninstalls the module', uninstall(['aws_opensearch']));
  it('reinstalls the module', install(['aws_opensearch']));

  it(
    'makes sure the domain is still there after installation',
    query(
      `
    SELECT * FROM domain WHERE domain_name = '${prefix}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());
  itDocs(
    'deletes the domain',
    query(
      `
    DELETE FROM domain WHERE domain_name = '${prefix}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies deletion of the domain', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
