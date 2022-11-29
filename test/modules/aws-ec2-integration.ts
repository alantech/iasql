import { EC2 } from '@aws-sdk/client-ec2';

import { TargetTypeEnum, ProtocolEnum } from '../../src/modules/aws_elb/entity';
import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runBegin,
  runCommit,
  runInstall,
  runInstallAll,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const { generateKeyPairSync } = require('crypto');
const sshpk = require('sshpk');

const dbAlias = 'ec2test';
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
let availabilityZone2: string;
let instanceType2: string;
const amznAmiId = 'resolve:ssm:/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2';
const ubuntuAmiId =
  'resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id';
const instancePort = 1234;

const prefix = getPrefix();
const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const querySync = runQuery.bind(null, `${dbAlias}_sync`);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const installSync = runInstall.bind(null, `${dbAlias}_sync`);
const syncCommit = runCommit.bind(null, `${dbAlias}_sync`);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_ec2', 'aws_ec2_metadata', 'aws_security_group', 'aws_vpc', 'aws_elb', 'aws_iam'];

// ELB integration
const tgType = TargetTypeEnum.INSTANCE;
const tgName = `${prefix}${dbAlias}tg`;
const tgPort = 4142;
const protocol = ProtocolEnum.HTTP;

// IAM integration
const roleName = `${prefix}-ec2-${region}`;
const ec2RolePolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: {
        Service: 'ec2.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
});

// Ebs integration
const gp2VolumeName = `${prefix}gp2volume`;
const gp3VolumeName = `${prefix}gp3volume`;

// Keypair integration
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});
const pemKey = sshpk.parseKey(publicKey, 'pem');
const sshRsa = pemKey.toString('ssh');

jest.setTimeout(560000);
beforeAll(async () => {
  const availabilityZones =
    (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone1 = availabilityZones.pop() ?? '';
  availabilityZone2 = availabilityZones.pop() ?? '';
  const instanceTypesByAz1 = await getInstanceTypeOffering([availabilityZone1]);
  instanceType1 = instanceTypesByAz1.InstanceTypeOfferings?.pop()?.InstanceType ?? '';
  const instanceTypesByAz2 = await getInstanceTypeOffering([availabilityZone2]);
  instanceType2 = instanceTypesByAz2.InstanceTypeOfferings?.pop()?.InstanceType ?? '';
  await execComposeUp();
});
afterAll(async () => await execComposeDown());

let username: string, password: string;

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

  it('creates a new test db to test sync', done =>
    void iasql.connect(`${dbAlias}_sync`, 'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', installSync(['aws_account']));

  it(
    'inserts aws credentials',
    querySync(
      `
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
    ),
  );

  it('syncs the regions', syncCommit());

  it(
    'sets the default region',
    querySync(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `),
  );

  it('installs the ec2 module', install(modules));

  it('starts a transaction', begin());

  it('adds two ec2 instance', done => {
    query(
      `
      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, subnet_id)
          SELECT '${ubuntuAmiId}', '${instanceType1}', '{"name":"${prefix}-1"}', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone1}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'),
          (SELECT id FROM security_group WHERE group_name='default' AND region = '${region}');
      COMMIT;

      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, subnet_id)
          SELECT '${amznAmiId}', '${instanceType2}', '{"name":"${prefix}-2"}', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone2}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2'),
          (SELECT id FROM security_group WHERE group_name='default' AND region = '${region}');
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

  it('Undo changes', rollback());

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());
  // generate keypairs
  it(
    'generates a new keypair',
    query(
      `
    SELECT *
    FROM key_pair_request ('${prefix}-key-request', '${region}');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1), expect(res[0].privateKey.toContain('-----BEGIN RSA PRIVATE KEY-----'));
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
    'check new keypair deleted',
    query(
      `
    SELECT *
    FROM key_pair
    WHERE name = '${prefix}-key-request';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'imports a new keypair',
    query(
      `
    SELECT *
    FROM key_pair_import ('${prefix}-key', '${sshRsa}', '${region}');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check new keypair added',
    query(
      `
    SELECT *
    FROM key_pair
    WHERE name = '${prefix}-key';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('adds an instance without security groups and key', done => {
    query(
      `
      BEGIN;
        INSERT INTO security_group (description, group_name)
        VALUES ('Fake security group', 'fake-security-group');
  
        INSERT INTO instance (ami, instance_type, tags, subnet_id)
          SELECT '${amznAmiId}', '${instanceType2}', '{"name":"${prefix}-2"}', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone2}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id, key_pair_name) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2'),
          (SELECT id FROM security_group WHERE group_name='fake-security-group' AND region = '${region}'), '${prefix}-key';
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

  it('applies the created instances', commit());

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes security group and instance',
    query(
      `
      BEGIN;
        DELETE FROM general_purpose_volume
        USING instance
        WHERE instance.id = general_purpose_volume.attached_instance_id AND
          (instance.tags ->> 'name' = '${prefix}-2');

        DELETE FROM instance  WHERE tags ->> 'name' = '${prefix}-2';
        DELETE FROM security_group WHERE group_name = 'fake-security-group';
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the security group and instance deletion', commit());

  it('starts a transaction', begin());

  it('adds two ec2 instance', done => {
    query(
      `
      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, user_data, subnet_id)
          SELECT '${ubuntuAmiId}', '${instanceType1}', '{"name":"${prefix}-1"}', 'ls;', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone1}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'),
          (SELECT id FROM security_group WHERE group_name='default' AND region = '${region}');
      COMMIT;

      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, user_data, subnet_id, hibernation_enabled)
          SELECT '${amznAmiId}', '${instanceType2}', '{"name":"${prefix}-2"}', 'pwd;', id, true
          FROM subnet
          WHERE availability_zone = '${availabilityZone2}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2'),
          (SELECT id FROM security_group WHERE group_name='default' AND region = '${region}');
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

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('applies the created instances', commit());

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  // TODO add table to allow creating key value pairs and then check user_data ran
  // https://stackoverflow.com/questions/15904095/how-to-check-whether-my-user-data-passing-to-ec2-instance-is-working
  it(
    'check user data',
    query(
      `
    SELECT user_data
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].user_data).toBe('ls;');
      },
    ),
  );

  it(
    'check user data',
    query(
      `
    SELECT user_data
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].user_data).toBe('pwd;');
      },
    ),
  );

  it(
    'check number of volumes',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    INNER JOIN instance on instance.id = general_purpose_volume.attached_instance_id
    WHERE instance.tags ->> 'name' = '${prefix}-1' OR
      instance.tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('syncs the changes from the first database to the second', syncCommit());

  it('starts a transaction', begin());

  it(
    'set both ec2 instances to the same ami',
    query(
      `
    UPDATE instance SET ami = '${amznAmiId}' WHERE tags ->> 'name' = '${prefix}-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the instances change', commit());

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it(
    'check instance ami update',
    query(
      `
    SELECT *
    FROM instance
    WHERE ami = '${ubuntuAmiId}' AND
    (tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2');
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  describe('create IAM role', () => {
    it('starts a transaction', begin());

    it(
      'creates ec2 instance role',
      query(
        `
      INSERT INTO iam_role (role_name, assume_role_policy_document)
      VALUES ('${roleName}', '${ec2RolePolicy}');
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it(
      'checks role count',
      query(
        `
      SELECT *
      FROM iam_role
      WHERE role_name = '${roleName}';
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );

    it('applies the role creation', commit());

    it(
      'checks role count',
      query(
        `
      SELECT *
      FROM iam_role
      WHERE role_name = '${roleName}';
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );
  });

  it('starts a transaction', begin());

  it(
    'create target group and register instance to it',
    query(
      `
    BEGIN;
      INSERT INTO target_group (target_group_name, target_type, protocol, port, health_check_path)
      VALUES ('${tgName}', '${tgType}', '${protocol}', ${tgPort}, '/health');

      INSERT INTO registered_instance (instance, target_group_id)
      SELECT (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'), (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check target group count',
    query(
      `
    SELECT *
    FROM target_group
    WHERE target_group_name = '${tgName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the instance registration', commit());

  it(
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check registered instance port',
    query(
      `
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}') AND instance.tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => {
        return expect(res[0].port).toBe(tgPort);
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'register instance with custom port to target group',
    query(
      `
    INSERT INTO registered_instance (instance, target_group_id, port)
    SELECT (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2'), (SELECT id FROM target_group WHERE target_group_name = '${tgName}'), ${instancePort}
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('applies the instance registration', commit());

  it(
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it(
    'check registered instance port',
    query(
      `
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}') AND instance.tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res[0].port).toBe(instancePort),
    ),
  );

  it('starts a transaction', begin());

  it(
    'updates register instance with custom port to target group',
    query(
      `
    UPDATE registered_instance
    SET port = ${instancePort + 1}
    FROM instance
    WHERE instance.id = registered_instance.instance AND target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}') AND instance.tags ->> 'name' = '${prefix}-2';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the instance registration', commit());

  it(
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it(
    'check registered instance port',
    query(
      `
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}') AND instance.tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res[0].port).toBe(instancePort + 1),
    ),
  );

  describe('update instance with IAM role', () => {
    it('starts a transaction', begin());

    it(
      'assigns role to instance',
      query(
        `
      UPDATE instance SET role_name = '${roleName}'
      WHERE tags ->> 'name' = '${prefix}-2';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it(
      'checks instance count',
      query(
        `
      SELECT *
      FROM instance
      WHERE role_name = '${roleName}';
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );

    it('applies the instance update', commit());

    it(
      'checks instance count',
      query(
        `
      SELECT *
      FROM instance
      WHERE role_name = '${roleName}';
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );
  });

  it('starts a transaction', begin());

  it(
    'stop instance',
    query(
      `
    UPDATE instance SET state = 'stopped'
    WHERE tags ->> 'name' = '${prefix}-2';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the instances change', commit());

  it(
    'check number of stopped instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE state = 'stopped' AND
    tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'start instance',
    query(
      `
    UPDATE instance SET state = 'running' WHERE tags ->> 'name' = '${prefix}-2';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the instances change', commit());

  it(
    'check number of running instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE state = 'running' AND
    tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'hibernates instance',
    query(
      `
    UPDATE instance SET state = 'hibernate'
    WHERE tags ->> 'name' = '${prefix}-2';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the instances change', commit());

  it(
    'check number of stopped instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE state = 'stopped' AND
    tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'start instance',
    query(
      `
    UPDATE instance SET state = 'running' WHERE tags ->> 'name' = '${prefix}-2';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the instances change', commit());

  it(
    'check number of running instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE state = 'running' AND
    tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the ec2 module', uninstall(modules));

  it('installs the ec2 module', install(modules));

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it(
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it(
    'check registered instance port',
    query(
      `
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}') AND instance.tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res[0].port).toBe(tgPort),
    ),
  );

  it(
    'check registered instance port',
    query(
      `
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}') AND instance.tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res[0].port).toBe(instancePort + 1),
    ),
  );

  it('starts a transaction', begin());

  it('adds an ec2 instance with no security group', done => {
    query(
      `
      INSERT INTO instance (ami, instance_type, tags, subnet_id)
        SELECT '${amznAmiId}', '${instanceType2}', '{"name":"${prefix}-nosg"}', id
        FROM subnet
        WHERE availability_zone = '${availabilityZone2}'
        LIMIT 1;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-nosg';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the created instances', commit());

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-nosg';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check number of security groups for instance',
    query(
      `
    SELECT *
    FROM instance_security_groups
    INNER JOIN instance ON instance.id = instance_security_groups.instance_id
    WHERE tags ->> 'name' = '${prefix}-nosg';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes one of the registered instances',
    query(
      `
    DELETE FROM registered_instance
    USING instance
    WHERE instance.tags ->> 'name' = '${prefix}-1' AND instance.id = registered_instance.instance;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies instance deregistration', commit());

  it(
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check instance metadata',
    query(
      `
    SELECT *
    FROM instance_metadata
    WHERE instance_id = (
      SELECT instance_id
      FROM instance
      WHERE tags ->> 'name' = '${prefix}-1'
    );
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].mem_size_mb).toBe(1024);
        expect(res[0].cpu_cores).toBe(1);
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'update instance metadata',
    query(
      `
    UPDATE instance_metadata SET cpu_cores = 10
    WHERE instance_id = (
      SELECT instance_id
      FROM instance
      WHERE tags ->> 'name' = '${prefix}-1'
    );
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('sync instances metadata update', commit());

  it(
    'check instance metadata did not change',
    query(
      `
    SELECT *
    FROM instance_metadata
    WHERE instance_id = (
      SELECT instance_id
      FROM instance
      WHERE tags ->> 'name' = '${prefix}-1'
    );
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].cpu_cores).toBe(1);
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes all ec2 instances',
    query(
      `
    BEGIN;
      DELETE FROM general_purpose_volume
      USING instance
      WHERE instance.id = general_purpose_volume.attached_instance_id AND
        (instance.tags ->> 'name' = '${prefix}-nosg' OR
        instance.tags ->> 'name' = '${prefix}-1' OR
        instance.tags ->> 'name' = '${prefix}-2');

      DELETE FROM instance
      WHERE tags ->> 'name' = '${prefix}-nosg' OR
        tags ->> 'name' = '${prefix}-1' OR
        tags ->> 'name' = '${prefix}-2';
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the instances deletion', commit());

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-nosg' OR
      tags ->> 'name' = '${prefix}-1' OR
      tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check number of volumes',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    INNER JOIN instance on instance.id = general_purpose_volume.attached_instance_id
    WHERE instance.tags ->> 'name' = '${prefix}-1' OR
      instance.tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check registered instance count, should be zero due to instance CASCADE deletion',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the target group',
    query(
      `
    DELETE FROM target_group
    WHERE target_group_name = '${tgName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies target group deletion', commit());

  it(
    'check target group count',
    query(
      `
    SELECT *
    FROM target_group
    WHERE target_group_name = '${tgName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  describe('delete role', () => {
    it('starts a transaction', begin());

    it(
      'deletes role',
      query(
        `
      DELETE FROM iam_role WHERE role_name = '${roleName}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it(
      'checks role count',
      query(
        `
      SELECT *
      FROM iam_role
      WHERE role_name = '${roleName}';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );

    it('applies the role deletion', commit());

    it(
      'checks role count',
      query(
        `
      SELECT *
      FROM iam_role
      WHERE role_name = '${roleName}';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );
  });

  // delete keypair
  it(
    'deletes the keypair',
    query(
      `
    DELETE FROM key_pair
    WHERE name = '${prefix}-key';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the keypair deletion', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));

  it('deletes the test sync db', done =>
    void iasql.disconnect(`${dbAlias}_sync`, 'not-needed').then(...finish(done)));
});

describe('EC2 General Purpose Volume Integration Testing', () => {
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

  it('installs the module', install(modules));

  it('starts a transaction', begin());

  it('adds new volumes', done => {
    query(
      `
      BEGIN;
        INSERT INTO general_purpose_volume (volume_type, availability_zone, tags)
        VALUES ('gp2', '${availabilityZone2}', '{"Name": "${gp2VolumeName}"}');

        INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags)
        VALUES ('gp3', '${availabilityZone1}', 50, '{"Name": "${gp3VolumeName}"}');
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => (!!e ? done(e) : done()));
  });

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('sync before apply', rollback());

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it('adds new volumes', done => {
    query(
      `
      BEGIN;
        INSERT INTO general_purpose_volume (volume_type, availability_zone, tags)
        VALUES ('gp2', '${availabilityZone2}', '{"Name": "${gp2VolumeName}"}');

        INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags)
        VALUES ('gp3', '${availabilityZone1}', 50, '{"Name": "${gp3VolumeName}"}');
      COMMIT;
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => (!!e ? done(e) : done()));
  });

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('applies the change', commit());

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('uninstalls the module', uninstall(modules));

  it('installs the module', install(modules));

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update a volume field to be restored',
    query(
      `
    UPDATE general_purpose_volume SET state = 'creating' WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change which will undo the change', commit());

  it(
    'checks volume restored',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `,
      (res: any[]) => expect(res[0].state).toBe('available'),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update a volume size',
    query(
      `
    UPDATE general_purpose_volume SET size = 150 WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'checks volume update',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res[0].size).toBe(150),
    ),
  );

  it('starts a transaction', begin());

  it('tries to update a volume availability zone', done => {
    query(
      `
      UPDATE general_purpose_volume
      SET availability_zone = '${availabilityZone2}'
      WHERE tags ->> 'Name' = '${gp3VolumeName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => (!!e ? done(e) : done()));
  });

  it('applies the change', commit());

  it(
    'checks volume count',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it(
    'checks volume replace',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `,
      (res: any[]) => expect(res[0].availability_zone).toBe(availabilityZone2),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update a volume availability zone',
    query(
      `
    UPDATE general_purpose_volume SET tags = '{"Name": "${gp2VolumeName}", "updated": true}' WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'checks volume update',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `,
      (res: any[]) => expect(res[0].tags.updated).toBe('true'),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the volumes',
    query(
      `
    DELETE FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'check deletes the volumes',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
    `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('EC2 install/uninstall', () => {
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

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  // Install can automatically pull in all dependencies, so we only need to specify ec2 here
  it('installs the ec2 module', install(['aws_ec2']));

  // But uninstall won't uninstall dependencies, so we need to specify that we want all three here
  it('uninstalls the ec2 module', uninstall(modules));

  it('installs all modules', installAll());

  it(
    'uninstall ec2 using overloaded sp',
    query(`
    select iasql_uninstall('aws_ec2_metadata');
  `),
  );

  it(
    'install ec2 using overloaded sp',
    query(`
    select iasql_install('aws_ec2_metadata');
  `),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
