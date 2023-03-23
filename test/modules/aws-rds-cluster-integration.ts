import { EC2 } from '@aws-sdk/client-ec2';

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
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'rdstest';

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const region = defaultRegion([
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ca-central-1',
  'eu-central-1',
  'eu-north-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'sa-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
]);

const modules = ['aws_security_group', 'aws_rds', 'aws_vpc'];
const engineVersion = '8.0.28';

jest.setTimeout(3600000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const ec2client = new EC2({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  region,
});

describe('DB Cluster Integration Testing', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs('installs the rds module', install(modules));

  // cluster testing
  it('starts a transaction', begin());

  itDocs(
    'creates an RDS subnet group',
    query(
      `
    INSERT INTO db_subnet_group (name, description, subnets)
    VALUES ('${prefix}cluster-test', 'test subnet group', (SELECT ARRAY(
      SELECT DISTINCT ON (subnet.availability_zone) subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true and vpc.region = '${region}' LIMIT 3
      )));
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the change', commit());

  itDocs(
    'check subnet group insertion',
    query(
      `
    SELECT *
    FROM db_subnet_group
    WHERE name = '${prefix}cluster-test';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'creates an RDS cluster',
    query(
      `
    INSERT INTO db_cluster (db_cluster_identifier, engine, engine_version, allocated_storage, iops, db_cluster_instance_class, master_username, master_user_password, subnet_group_id, tags, deletion_protection) VALUES
      ('${prefix}cluster-test', 'mysql', '${engineVersion}', 100, 1000, 'db.m5d.xlarge', 'admin', 'admin123456', (select id FROM db_subnet_group WHERE name = '${prefix}cluster-test'), '{"name":"${prefix}-1"}', TRUE);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check adds a new db cluster',
    query(
      `
    SELECT *
    FROM db_cluster
    WHERE tags->>'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'changes the backup retention period',
    query(
      `
    UPDATE db_cluster SET backup_retention_period=10 WHERE tags->>'name' = '${prefix}-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check that retention period has been modified',
    query(
      `
    SELECT *
    FROM db_cluster
    WHERE tags->>'name' = '${prefix}-1' AND backup_retention_period=10;
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'tries to update an instance belonging to a cluster',
    query(
      `
    UPDATE rds SET backup_retention_period=3 WHERE db_cluster_id = (SELECT id FROM db_cluster WHERE db_cluster_identifier='${prefix}cluster-test');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check that backup retention period for instances has not been modified',
    query(
      `
    SELECT *
    FROM rds
    WHERE db_cluster_id = (SELECT id FROM db_cluster WHERE db_cluster_identifier = '${prefix}cluster-test') AND backup_retention_period=3;
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'removes the RDS cluster',
    query(
      `
    DELETE FROM db_cluster
    WHERE tags->>'name' = '${prefix}-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('confirms that you cannot delete a cluster with protection enabled', done =>
    void query(`
    SELECT * FROM iasql_commit();
  `)((e?: any) => {
      console.log({ e });
      try {
        expect(e?.message).toContain('Cannot delete a cluster with deletion protection');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it('starts a transaction', begin());

  itDocs(
    'updates db_cluster tags and removes deletion protection',
    query(
      `
    UPDATE db_cluster SET tags = '{"name":"${prefix}-2"}', deletion_protection=FALSE WHERE tags ->> 'name' = '${prefix}-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it('starts a transaction', begin());

  itDocs(
    'removes the RDS cluster',
    query(
      `
    DELETE FROM db_cluster
    WHERE tags->>'name' = '${prefix}-2';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check RDS cluster delete count',
    query(
      `
    SELECT *
    FROM db_cluster
    WHERE tags->>'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'removes the db subnet group and its parameters',
    query(
      `
    DELETE FROM db_subnet_group
    WHERE name = '${prefix}cluster-test';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check subnet group count after delete',
    query(
      `
    SELECT *
    FROM db_subnet_group
    WHERE name = '${prefix}cluster-test';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
