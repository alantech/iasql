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
  runUninstall,
} from '../helpers';

const dbAlias = 'sshaccounttest';
const region = defaultRegion();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const ec2client = new EC2({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  region,
});

const getAvailabilityZones = async () => {
  return await ec2client.describeAvailabilityZones({
    Filters: [
      {
        Name: 'region-name',
        Values: [region],
      },
    ],
  });
};

const getInstanceTypeOffering = async (availabilityZones: string[]) => {
  return await ec2client.describeInstanceTypeOfferings({
    LocationType: 'availability-zone',
    Filters: [
      {
        Name: 'location',
        Values: availabilityZones,
      },
      {
        Name: 'instance-type',
        Values: ['t2.micro', 't3.micro'],
      },
    ],
  });
};
let availabilityZone1: string;
let instanceType1: string;
const ubuntuAmiId =
  'resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id';

const prefix = getPrefix();
const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);

const modules = ['aws_ec2'];

jest.setTimeout(560000);
beforeAll(async () => {
  const availabilityZones =
    (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone1 = availabilityZones.pop() ?? '';
  const instanceTypesByAz1 = await getInstanceTypeOffering([availabilityZone1]);
  instanceType1 = instanceTypesByAz1.InstanceTypeOfferings?.pop()?.InstanceType ?? '';
  await execComposeUp();
});
afterAll(async () => await execComposeDown());

let username: string, password: string, privateKey: string;

describe('EC2 Integration Testing', () => {
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
  it('installs the ssh_accounts and aws_ec2_metadata modules', install(['ssh_accounts', 'aws_ec2_metadata']));

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

  it('installs the ec2 module', install(['aws_ec2']));

  // generate keypairs
  it(
    'generates a new keypair',
    query(
      `
    SELECT * FROM key_pair_request ('${prefix}-key-request', '${region}');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        console.log(res);
        privateKey = res[0].privatekey;
      },
    ),
  );

  it(
    'check new keypair added',
    query(
      `
    SELECT *
    FROM key_pair
    WHERE name = '${prefix}-key-request';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it('generates security groups', done => {
    query(
      `
      BEGIN;
        INSERT INTO security_group (description, group_name)
        VALUES ('ssh security group', 'ssh-${prefix}-sg');

        INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
        SELECT false, 'tcp', 22, 22, '0.0.0.0/0', '${prefix}sshrule', id
        FROM security_group
        WHERE group_name = 'ssh-${prefix}-sg';
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('commits the transaction', commit());

  it('starts a transaction', begin());

  it('generates instances', done => {
    query(
      `
      BEGIN;
      INSERT INTO instance (ami, instance_type, key_pair_name, tags, subnet_id)
      SELECT '${ubuntuAmiId}', '${instanceType1}', '${prefix}-key-request', '{"name":"ssh-${prefix}-1"}', id
      FROM subnet
      WHERE availability_zone = '${availabilityZone1}'
      LIMIT 1;
  
    INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
      (SELECT id FROM instance WHERE tags ->> 'name' = 'ssh-${prefix}-1'),
      (SELECT id FROM security_group WHERE group_name='ssh-${prefix}-sg' AND region = '${region}');
  COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });
  it('commits the transaction', commit());

  it('starts a transaction', begin());

  it('adds a new ssh server', done => {
    query(
      `
      INSERT INTO ssh_credentials ("name", hostname, username, private_key)
      VALUES ('${prefix}', (
        SELECT host(im.public_ip_address)
        FROM instance_metadata im
        INNER JOIN instance i ON im.instance_id = i.instance_id
        WHERE i.tags ->> 'name' = 'ssh-${prefix}-1'
        LIMIT 1
      ), 'ubuntu', $$${privateKey}$$);
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });
  it('applies the ssh credentials', commit());

  /*itDocs(
    'can run a command',
    query(
      `
    SELECT * FROM ssh_exec('${prefix}', 'echo Hello, World');
  `,
      (res: any[]) => expect(res[0].stdout.trim()).toEqual('Hello, World'),
    ),
  );

  itDocs(
    'can list a directory',
    query(
      `
    SELECT * FROM ssh_ls('${prefix}', '/home/ubuntu');
  `,
      (res: any[]) => expect(res.length).toBeGreaterThan(0),
    ),
  );

  itDocs(
    'can create a directory',
    query(
      `
    SELECT * FROM ssh_mkdir('${prefix}', '/home/ubuntu/${prefix}');
  `,
      (res: any[]) => expect(res[0].status).toEqual('created'),
    ),
  );

  itDocs(
    'can create a file',
    query(
      `
    SELECT * FROM ssh_write_file_text('${prefix}', '/home/ubuntu/${prefix}.txt', 'test file');
  `,
      (res: any[]) => expect(res[0].status).toEqual('written'),
    ),
  );

  itDocs(
    'can read a file',
    query(
      `
    SELECT * FROM ssh_read_file_text('${prefix}', '/home/ubuntu/${prefix}.txt');
  `,
      (res: any[]) => expect(res[0].data).toEqual('test file'),
    ),
  );

  itDocs(
    'can move a file',
    query(
      `
    SELECT * FROM ssh_mv('${prefix}', '/home/ubuntu/${prefix}.txt', '/home/ubuntu/${prefix}/new_location');
  `,
      (res: any[]) => expect(res[0].status).toEqual('moved'),
    ),
  );

  itDocs(
    'can delete a file',
    query(
      `
    SELECT * FROM ssh_rm('${prefix}', '/home/ubuntu/${prefix}/new_location');
  `,
      (res: any[]) => expect(res[0].status).toEqual('deleted'),
    ),
  );

  itDocs(
    'can delete a directory',
    query(
      `
    SELECT * FROM ssh_rmdir('${prefix}', '/home/ubuntu/${prefix}');
  `,
      (res: any[]) => expect(res[0].status).toEqual('deleted'),
    ),
  );*/

  it('starts a transaction', begin());

  it(
    'deletes the ssh server',
    query(`
    DELETE FROM ssh_credentials WHERE "name" = '${prefix}';
  `),
  );

  it('applies the ssh deletion', commit());

  it('starts a transaction', begin());

  it(
    'deletes the ec2 instance',
    query(`
    DELETE FROM instance WHERE tags ->> 'name' = 'ssh-${prefix}-1';
  `),
  );

  it('applies the ec2 deletion', commit());

  it('starts a transaction', begin());
  it(
    'deletes the keypair',
    query(
      `
    DELETE FROM key_pair
    WHERE name = '${prefix}-key-request';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the keypair deletion', commit());

  it(
    'confirms keypair deleted',
    query(
      `
    SELECT *
    FROM key_pair
    WHERE name = '${prefix}-key-request';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());
  it(
    'deletes the security group',
    query(`
    DELETE FROM security_group_rule WHERE description = '${prefix}sshrule';
    DELETE FROM security_group WHERE group_name = 'ssh-${prefix}-sg';
  `),
  );
  it('applies the security group deletion', commit());

  it('uninstalls the modules', uninstall(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
