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
  runQuery,
} from '../helpers';

const dbAlias = 'ec2multi';
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
const install = runInstall.bind(null, dbAlias);
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

  it('installs the ec2 module', install(modules));

  it('starts a transaction', begin());

  it('adds an ec2 instance', done => {
    query(
      `
      INSERT INTO instance (ami, instance_type, tags, subnet_id)
        SELECT '${ubuntuAmiId}', '${instanceType1}', '{"name":"${prefix}-1"}', id
        FROM subnet
        WHERE availability_zone = '${availabilityZone1}'
        LIMIT 1;
      INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
        (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'),
        (SELECT id FROM security_group WHERE group_name='default' AND region = '${region}');
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
    WHERE tags ->> 'name' = '${prefix}-1';
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
    WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check number of volumes',
    query(
      `
    SELECT *
    FROM general_purpose_volume
    INNER JOIN instance on instance.id = general_purpose_volume.attached_instance_id
    WHERE instance.tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('syncs the cloud state to update the metadata', commit());

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
    WHERE
      target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}') AND
      instance.tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => {
        console.log(JSON.stringify(res));
        return expect(res[0]['port']).toBe(tgPort);
      },
    ),
  );

  it(
    'moves the instance to another region',
    query(
      `
    -- You can't move a registered instance at all, so unregister it
    DELETE FROM registered_instance WHERE instance = (
      SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'
    );
    -- Because of interlinking constraints, we need to first "detach" the volume from the instance
    -- then update the instance, then re-attach it. Hence the volume being updated twice to go to
    -- a new region
    UPDATE general_purpose_volume
    SET
      volume_id = null,
      attached_instance_id = null,
      instance_device_name = null,
      snapshot_id = null
    WHERE attached_instance_id = (
      SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'
    );
    -- We have to make sure the subnet is correct and we have to re-assign the AMI ID because they
    -- are different between regions
    UPDATE instance
    SET
      instance_id = null,
      region = 'us-east-1',
      ami = '${ubuntuAmiId}',
      subnet_id = (
        SELECT id FROM subnet WHERE region = 'us-east-1' AND availability_zone = 'us-east-1a'
      )
    WHERE tags ->> 'name' = '${prefix}-1';
    -- Re-attaching of the volume. But it is given a different name since /dev/xvda is reserved for
    -- the initial boot volume and can't be re-used here. Technically an equivalent version of this
    -- volume is automatically re-attached by the new instance being brought up.
    UPDATE general_purpose_volume
    SET
      region = 'us-east-1',
      availability_zone = 'us-east-1a',
      attached_instance_id = (
        SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'
      ),
      instance_device_name = '/dev/xvdb'
    WHERE attached_instance_id IS NULL;
    -- Also need to drop the security groups it is currently attached to. This is done with a join
    -- table so we get no good constraint checking on the validity here at the moment
    DELETE FROM instance_security_groups WHERE instance_id = (
      SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'
    );
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the move', commit());

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('syncs the cloud state to update the metadata', commit());

  it(
    'check instance metadata again',
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
        expect(res[0].region).toBe('us-east-1');
      },
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
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the instance',
    query(
      `
      DELETE FROM general_purpose_volume
      USING instance
      WHERE instance.id = general_purpose_volume.attached_instance_id AND 
        instance.tags ->> 'name' = '${prefix}-1';

      DELETE FROM instance
      WHERE tags ->> 'name' = '${prefix}-1';
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

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
