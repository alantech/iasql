import { EC2 } from '@aws-sdk/client-ec2';

import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  getPrefix,
  runQuery,
  runInstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
} from '../helpers';

const dbAlias = 'ec2multi';
const region = process.env.AWS_REGION ?? '';
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
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
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

describe('EC2 Integration Testing', () => {
  it('creates a new test db', done =>
    void iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

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
    ),
  );

  it('syncs the regions', sync());

  it(
    'sets the default region',
    query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${process.env.AWS_REGION}';
  `),
  );

  it('installs the ec2 module', install(modules));

  it('adds and ec2 instance', done => {
    query(`
      INSERT INTO instance (ami, instance_type, tags, subnet_id)
        SELECT '${ubuntuAmiId}', '${instanceType1}', '{"name":"${prefix}-1"}', id
        FROM subnet
        WHERE availability_zone = '${availabilityZone1}'
        LIMIT 1;
      INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
        (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'),
        (SELECT id FROM security_group WHERE group_name='default' AND region = '${process.env.AWS_REGION}');
    `)((e?: any) => {
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

  it('applies the created instances', apply());

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

  describe('create IAM role', () => {
    it(
      'creates ec2 instance role',
      query(`
      INSERT INTO iam_role (role_name, assume_role_policy_document)
      VALUES ('${roleName}', '${ec2RolePolicy}');
    `),
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

    it('applies the role creation', apply());

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

  it(
    'create target group and register instance to it',
    query(`
    BEGIN;
      INSERT INTO target_group (target_group_name, target_type, protocol, port, health_check_path)
      VALUES ('${tgName}', '${tgType}', '${protocol}', ${tgPort}, '/health');

      INSERT INTO registered_instance (instance, target_group)
      SELECT (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'), '${tgName}';
    COMMIT;
  `),
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
    WHERE target_group = '${tgName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the instance registration', apply());

  it(
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
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
    WHERE target_group = '${tgName}' AND instance.tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => {
        console.log(JSON.stringify(res));
        return expect(res[0]['port']).toBe(tgPort);
      },
    ),
  );

  it('moves the instance to another region', query(`
      DELETE FROM registered_instance WHERE instance = (
        SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'
      );
      UPDATE general_purpose_volume gpv
      SET
        region = 'us-east-1',
        availability_zone = 'us-east-1a',
        tags = '{"tomove": "thisone"}',
        attached_instance_id = null
      WHERE attached_instance_id = (
        SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'
      );
      UPDATE instance SET region = 'us-east-1' WHERE tags ->> 'name' = '${prefix}-1';
      UPDATE general_purpose_volume SET attached_instance_id = (
        SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'
      ) WHERE tags ->> 'tomove' = 'thisone';
  `));

  it('applies the move', apply());

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
    'check registered instance count',
    query(
      `
    SELECT *
    FROM registered_instance
    WHERE target_group = '${tgName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'deletes the instance',
    query(`
      DELETE FROM general_purpose_volume
      USING instance
      WHERE instance.id = general_purpose_volume.attached_instance_id AND 
        instance.tags ->> 'name' = '${prefix}-1';

      DELETE FROM instance
      WHERE tags ->> 'name' = '${prefix}-1';
  `),
  );

  it('applies the instances deletion', apply());

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
    WHERE target_group = '${tgName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'deletes the target group',
    query(`
    DELETE FROM target_group
    WHERE target_group_name = '${tgName}';
  `),
  );

  it('applies target group deletion', apply());

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
    it(
      'deletes role',
      query(`
      DELETE FROM iam_role WHERE role_name = '${roleName}';
    `),
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

    it('applies the role deletion', apply());

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
