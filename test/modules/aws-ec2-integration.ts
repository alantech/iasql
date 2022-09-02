import { EC2 } from '@aws-sdk/client-ec2'
import config from '../../src/config'
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const dbAlias = 'ec2test';
const region = process.env.AWS_REGION ?? '';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const ec2client = new EC2({
  credentials: {
    accessKeyId,
    secretAccessKey
  },
  region
});

const getAvailabilityZones = async () => {
  return await ec2client.describeAvailabilityZones({
    Filters: [
      {
        Name: 'region-name',
        Values: [region,],
      },
    ],
  })
}

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
      }
    ],
  });
}
let availabilityZone1: string;
let instanceType1: string;
let availabilityZone2: string;
let instanceType2: string;
const amznAmiId = 'resolve:ssm:/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2';
const ubuntuAmiId = 'resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id';
const instancePort = 1234;

const prefix = getPrefix();
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const querySync = runQuery.bind(null, `${dbAlias}_sync`);
const install = runInstall.bind(null, dbAlias);
const installSync = runInstall.bind(null, `${dbAlias}_sync`);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_ec2', 'aws_ec2_metadata', 'aws_security_group', 'aws_vpc', 'aws_elb', 'aws_iam'];

// ELB integration
const {
  TargetTypeEnum,
  ProtocolEnum,
} = require(`../../src/modules/${config.modules.latestVersion}/aws_elb/entity`);
const tgType = TargetTypeEnum.INSTANCE;
const tgName = `${prefix}${dbAlias}tg`;
const tgPort = 4142;
const protocol = ProtocolEnum.HTTP;

// IAM integration
const roleName = `${prefix}-ec2-${region}`;
const ec2RolePolicy = JSON.stringify({
  "Version": "2012-10-17",
  "Statement": [
      {
          "Effect": "Allow",
          "Principal": {
              "Service": "ec2.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
      }
  ]
});

// Ebs integration
const gp2VolumeName = `${prefix}gp2volume`;
const gp3VolumeName = `${prefix}gp3volume`;

jest.setTimeout(560000);
beforeAll(async () => {
  const availabilityZones = (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone1 = availabilityZones.pop() ?? '';
  availabilityZone2 = availabilityZones.pop() ?? '';
  const instanceTypesByAz1 = await getInstanceTypeOffering([availabilityZone1]);
  instanceType1 = instanceTypesByAz1.InstanceTypeOfferings?.pop()?.InstanceType ?? '';
  const instanceTypesByAz2 = await getInstanceTypeOffering([availabilityZone2]);
  instanceType2 = instanceTypesByAz2.InstanceTypeOfferings?.pop()?.InstanceType ?? '';
  await execComposeUp()
});
afterAll(async () => await execComposeDown());

describe('EC2 Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${process.env.AWS_REGION}';
  `));

  it('creates a new test db to test sync', (done) => void iasql.connect(
    `${dbAlias}_sync`,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', installSync(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `));

  it('installs the ec2 module', install(modules));

  it('adds two ec2 instance', (done) => {
    query(`
      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, subnet_id)
          SELECT '${ubuntuAmiId}', '${instanceType1}', '{"name":"${prefix}-1"}', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone1}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'),
          (SELECT id FROM security_group WHERE group_name='default');
      COMMIT;

      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, subnet_id)
          SELECT '${amznAmiId}', '${instanceType2}', '{"name":"${prefix}-2"}', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone2}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2'),
          (SELECT id FROM security_group WHERE group_name='default');
      COMMIT;
    `)((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('Undo changes', sync());

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds two ec2 instance', (done) => {
    query(`
      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, user_data, subnet_id)
          SELECT '${ubuntuAmiId}', '${instanceType1}', '{"name":"${prefix}-1"}', 'ls;', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone1}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'),
          (SELECT id FROM security_group WHERE group_name='default');
      COMMIT;

      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, user_data, subnet_id, hibernation_enabled)
          SELECT '${amznAmiId}', '${instanceType2}', '{"name":"${prefix}-2"}', 'pwd;', id, true
          FROM subnet
          WHERE availability_zone = '${availabilityZone2}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2'),
          (SELECT id FROM security_group WHERE group_name='default');
      COMMIT;
    `)((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('applies the created instances', apply());

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(2)));

  // TODO add table to allow creating key value pairs and then check user_data ran
  // https://stackoverflow.com/questions/15904095/how-to-check-whether-my-user-data-passing-to-ec2-instance-is-working
  it('check user data', query(`
    SELECT user_data
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1';
  `, (res: any[]) => {
    expect(res.length).toBe(1);
    expect(res[0].user_data).toBe('ls;');
  }));

  it('check user data', query(`
    SELECT user_data
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => {
    expect(res.length).toBe(1);
    expect(res[0].user_data).toBe('pwd;');
  }));

  it('check number of volumes', query(`
    SELECT *
    FROM general_purpose_volume
    INNER JOIN instance on instance.id = general_purpose_volume.attached_instance_id
    WHERE instance.tags ->> 'name' = '${prefix}-1' OR
      instance.tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('syncs the changes from the first database to the second', runSync(`${dbAlias}_sync`));

  it('set both ec2 instances to the same ami', query(`
    UPDATE instance SET ami = '${amznAmiId}' WHERE tags ->> 'name' = '${prefix}-1';
  `));

  it('applies the instances change', apply());

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('check instance ami update', query(`
    SELECT *
    FROM instance
    WHERE ami = '${ubuntuAmiId}' AND
    (tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2');
  `, (res: any[]) => expect(res.length).toBe(0)));

  describe('create IAM role', () => {
    it('creates ec2 nstance role', query(`
      INSERT INTO role (role_name, assume_role_policy_document)
      VALUES ('${roleName}', '${ec2RolePolicy}');
    `));

    it('checks role count', query(`
      SELECT *
      FROM role
      WHERE role_name = '${roleName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('applies the role creation', apply());

    it('checks role count', query(`
      SELECT *
      FROM role
      WHERE role_name = '${roleName}';
    `, (res: any[]) => expect(res.length).toBe(1)));
  });

  it('create target group and register instance to it', query(`
    BEGIN;
      INSERT INTO target_group (target_group_name, target_type, protocol, port, health_check_path)
      VALUES ('${tgName}', '${tgType}', '${protocol}', ${tgPort}, '/health');

      INSERT INTO registered_instance (instance, target_group)
      SELECT (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'), '${tgName}';
    COMMIT;
  `));

  it('check target group count', query(`
    SELECT *
    FROM target_group
    WHERE target_group_name = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check registered instance count', query(`
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the instance registration', apply());

  it('check registered instance count', query(`
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check registered instance port', query(`
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group = '${tgName}' AND instance.tags ->> 'name' = '${prefix}-1';
  `, (res: any[]) => {
    console.log(JSON.stringify(res));
    return expect(res[0]['port']).toBe(tgPort);
  }));

  it('register instance with custom port to target group', query(`
    INSERT INTO registered_instance (instance, target_group, port)
    SELECT (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2'), '${tgName}', ${instancePort}
  `));

  it('check registered instance count', query(`
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('applies the instance registration', apply());

  it('check registered instance count', query(`
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('check registered instance port', query(`
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group = '${tgName}' AND instance.tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res[0]['port']).toBe(instancePort)));

  it('updates register instance with custom port to target group', query(`
    UPDATE registered_instance
    SET port = ${instancePort + 1}
    FROM instance
    WHERE instance.id = registered_instance.instance AND target_group = '${tgName}' AND instance.tags ->> 'name' = '${prefix}-2';
  `));

  it('applies the instance registration', apply());

  it('check registered instance count', query(`
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('check registered instance port', query(`
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group = '${tgName}' AND instance.tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res[0]['port']).toBe(instancePort + 1)))

  describe('update instance with IAM role', () => {
    it('assigns role to instance', query(`
      UPDATE instance SET role_name = '${roleName}'
      WHERE tags ->> 'name' = '${prefix}-2';
    `));

    it('checks instance count', query(`
      SELECT *
      FROM instance
      WHERE role_name = '${roleName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('applies the instance update', apply());

    it('checks instance count', query(`
      SELECT *
      FROM instance
      WHERE role_name = '${roleName}';
    `, (res: any[]) => expect(res.length).toBe(1)));
  });

  it('stop instance', query(`
    UPDATE instance SET state = 'stopped'
    WHERE tags ->> 'name' = '${prefix}-2';
  `));

  it('applies the instances change', apply());

  it('check number of stopped instances', query(`
    SELECT *
    FROM instance
    WHERE state = 'stopped' AND
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('start instance', query(`
    UPDATE instance SET state = 'running' WHERE tags ->> 'name' = '${prefix}-2';
  `));

  it('applies the instances change', apply());

  it('check number of running instances', query(`
    SELECT *
    FROM instance
    WHERE state = 'running' AND
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('hibernates instance', query(`
    UPDATE instance SET state = 'hibernate'
    WHERE tags ->> 'name' = '${prefix}-2';
  `));

  it('applies the instances change', apply());

  it('check number of stopped instances', query(`
    SELECT *
    FROM instance
    WHERE state = 'stopped' AND
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('start instance', query(`
    UPDATE instance SET state = 'running' WHERE tags ->> 'name' = '${prefix}-2';
  `));

  it('applies the instances change', apply());

  it('check number of running instances', query(`
    SELECT *
    FROM instance
    WHERE state = 'running' AND
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('uninstalls the ec2 module', uninstall(modules));

  it('installs the ec2 module', install(modules));

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('check registered instance count', query(`
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('check registered instance port', query(`
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group = '${tgName}' AND instance.tags ->> 'name' = '${prefix}-1';
  `, (res: any[]) => expect(res[0]['port']).toBe(tgPort)));

  it('check registered instance port', query(`
    SELECT *
    FROM registered_instance
    INNER JOIN instance ON instance.id = registered_instance.instance
    WHERE target_group = '${tgName}' AND instance.tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res[0]['port']).toBe(instancePort + 1)));

  it('adds an ec2 instance with no security group', (done) => {
    query(`
      INSERT INTO instance (ami, instance_type, tags, subnet_id)
        SELECT '${amznAmiId}', '${instanceType2}', '{"name":"${prefix}-nosg"}', id
        FROM subnet
        WHERE availability_zone = '${availabilityZone2}'
        LIMIT 1;
    `)((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-nosg';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the created instances', apply());

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-nosg';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check number of security groups for instance', query(`
    SELECT *
    FROM instance_security_groups
    INNER JOIN instance ON instance.id = instance_security_groups.instance_id
    WHERE tags ->> 'name' = '${prefix}-nosg';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('deletes one of the registered instances', query(`
    DELETE FROM registered_instance
    USING instance
    WHERE instance.tags ->> 'name' = '${prefix}-1' AND instance.id = registered_instance.instance;
  `));

  it('check registered instance count', query(`
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies instance deregistration', apply());

  it('check registered instance count', query(`
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check instance metadata', query(`
    SELECT *
    FROM instance_metadata
    WHERE instance_id = (
      SELECT instance_id
      FROM instance
      WHERE tags ->> 'name' = '${prefix}-1'
    );
  `, (res: any[]) => {
    expect(res.length).toBe(1);
    expect(res[0].mem_size_mb).toBe(1024);
    expect(res[0].cpu_cores).toBe(1);
  }));

  it('update instance metadata', query(`
    UPDATE instance_metadata SET cpu_cores = 10
    WHERE instance_id = (
      SELECT instance_id
      FROM instance
      WHERE tags ->> 'name' = '${prefix}-1'
    );
  `));

  it('sync instances metadata update', sync());

  it('check instance metadata did not change', query(`
    SELECT *
    FROM instance_metadata
    WHERE instance_id = (
      SELECT instance_id
      FROM instance
      WHERE tags ->> 'name' = '${prefix}-1'
    );
  `, (res: any[]) => {
    expect(res.length).toBe(1);
    expect(res[0].cpu_cores).toBe(1);
  }));

  it('deletes all ec2 instances', query(`
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
  `));

  it('applies the instances deletion', apply());

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-nosg' OR
      tags ->> 'name' = '${prefix}-1' OR
      tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check number of volumes', query(`
    SELECT *
    FROM general_purpose_volume
    INNER JOIN instance on instance.id = general_purpose_volume.attached_instance_id
    WHERE instance.tags ->> 'name' = '${prefix}-1' OR
      instance.tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check registered instance count, should be zero due to instance CASCADE deletion', query(`
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the target group', query(`
    DELETE FROM target_group
    WHERE target_group_name = '${tgName}';
  `));

  it('applies target group deletion', apply());

  it('check target group count', query(`
    SELECT *
    FROM target_group
    WHERE target_group_name = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  describe('delete role', () => {
    it('deletes role', query(`
      DELETE FROM role WHERE role_name = '${roleName}';
    `));

    it('checks role count', query(`
      SELECT *
      FROM role
      WHERE role_name = '${roleName}';
    `, (res: any[]) => expect(res.length).toBe(0)));

    it('applies the role deletion', apply());

    it('checks role count', query(`
      SELECT *
      FROM role
      WHERE role_name = '${roleName}';
    `, (res: any[]) => expect(res.length).toBe(0)));
  });

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));

  it('deletes the test sync db', (done) => void iasql
    .disconnect(`${dbAlias}_sync`, 'not-needed')
    .then(...finish(done)));
});

describe('EC2 General Purpose Volume Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${process.env.AWS_REGION}';
  `));

  it('installs the module', install(modules));

  it('adds new volumes', (done) => {
    query(`
      BEGIN;
        INSERT INTO general_purpose_volume (volume_type, availability_zone, tags)
        VALUES ('gp2', '${availabilityZone2}', '{"Name": "${gp2VolumeName}"}');

        INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags)
        VALUES ('gp3', '${availabilityZone1}', 50, '{"Name": "${gp3VolumeName}"}');
      COMMIT;
    `)((e?: any) => !!e ? done(e) : done());
  });

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('sync before apply', sync());

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(0)));
  
  it('adds new volumes', (done) => {
    query(`
      BEGIN;
        INSERT INTO general_purpose_volume (volume_type, availability_zone, tags)
        VALUES ('gp2', '${availabilityZone2}', '{"Name": "${gp2VolumeName}"}');

        INSERT INTO general_purpose_volume (volume_type, availability_zone, size, tags)
        VALUES ('gp3', '${availabilityZone1}', 50, '{"Name": "${gp3VolumeName}"}');
      COMMIT;
    `)((e?: any) => !!e ? done(e) : done());
  });

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('applies the change', apply());

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('uninstalls the module', uninstall(modules));

  it('installs the module', install(modules));

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('tries to update a volume field to be restored', query(`
    UPDATE general_purpose_volume SET state = 'creating' WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `));
  
  it('applies the change which will undo the change', apply());
  
  it('checks volume restored', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `, (res: any[]) => expect(res[0]['state']).toBe('available')));

  it('tries to update a volume size', query(`
    UPDATE general_purpose_volume SET size = 150 WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `));

  it('applies the change', apply());

  it('checks volume update', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res[0]['size']).toBe(150)));

  it('tries to update a volume availability zone', (done) => {
    query(`
      UPDATE general_purpose_volume
      SET availability_zone = '${availabilityZone2}'
      WHERE tags ->> 'Name' = '${gp3VolumeName}';
    `)((e?: any) => !!e ? done(e) : done());
  });

  it('applies the change', apply());

  it('checks volume count', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('checks volume replace', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp3VolumeName}';
  `, (res: any[]) => expect(res[0]['availability_zone']).toBe(availabilityZone2)));

  it('tries to update a volume availability zone', query(`
    UPDATE general_purpose_volume SET tags = '{"Name": "${gp2VolumeName}", "updated": true}' WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `));

  it('applies the change', apply());

  it('checks volume update', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}';
  `, (res: any[]) => expect(res[0]['tags']['updated']).toBe('true')));

  it('deletes the volumes', query(`
    DELETE FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
  `));

  it('applies the change', apply());

  it('check deletes the volumes', query(`
    SELECT *
    FROM general_purpose_volume
    WHERE tags ->> 'Name' = '${gp2VolumeName}' OR tags ->> 'Name' = '${gp3VolumeName}';
    `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('EC2 install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `));

  // Install can automatically pull in all dependencies, so we only need to specify ec2 here
  it('installs the ec2 module', install(['aws_ec2']));

  // But uninstall won't uninstall dependencies, so we need to specify that we want all three here
  it('uninstalls the ec2 module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstall ec2 using overloaded sp', query(`
    select iasql_uninstall('aws_ec2_metadata');
  `));

  it('install ec2 using overloaded sp', query(`
    select iasql_install('aws_ec2_metadata');
  `));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
