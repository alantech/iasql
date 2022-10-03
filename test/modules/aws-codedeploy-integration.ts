import { EC2 } from '@aws-sdk/client-ec2';

import * as iasql from '../../src/services/iasql';
import {
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runApply,
  runInstall,
  runQuery,
  runSync,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'codedeploytest';
const applicationName = `${prefix}${dbAlias}application`;
const applicationNameForDeployment = `${prefix}${dbAlias}applicationForDeployment`;
const deploymentGroupName = `${prefix}${dbAlias}deployment_group`;
const ubuntuAmiId =
  'resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id';

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

const roleName = `${prefix}-codedeploy-${region}`;
const ec2RolePolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Sid: '',
      Effect: 'Allow',
      Principal: {
        Service: ['codedeploy.amazonaws.com'],
      },
      Action: 'sts:AssumeRole',
    },
  ],
});

const ec2FilterTags = JSON.stringify([
  {
    Type: 'KEY_AND_VALUE',
    Key: 'name',
    Value: `${prefix}-vm`,
  },
]);

const revisionLocationv0 = JSON.stringify({
  revisionType: 'GitHub',
  gitHubLocation: {
    repository: 'aws-samples/aws-codedeploy-samples',
    commitId: '7b2c0d6515c1c59eeedd409b752ceec0aae4d886',
  },
});

const revisionLocationv1 = JSON.stringify({
  revisionType: 'GitHub',
  gitHubLocation: {
    repository: 'aws-samples/aws-codedeploy-samples',
  },
});

let availabilityZone: string;
let instanceType: string;

const apply = runApply.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const modules = ['aws_codedeploy', 'aws_iam', 'aws_ec2'];

jest.setTimeout(560000);
beforeAll(async () => {
  /*const availabilityZones =
    (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone = availabilityZones.pop() ?? '';
  const instanceTypesByAz1 = await getInstanceTypeOffering([availabilityZone]);
  instanceType = instanceTypesByAz1.InstanceTypeOfferings?.pop()?.InstanceType ?? '';*/

  await execComposeUp();
});
afterAll(async () => await execComposeDown());

describe('AwsCodedeploy Integration Testing', () => {
  it('creates a new test db with the same name', done =>
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

  it('installs the codedeploy module and dependencies', install(modules));

  /*it(
    'creates ec2 instance role',
    query(`
    INSERT INTO iam_role (role_name, assume_role_policy_document)
    VALUES ('${roleName}', '${ec2RolePolicy}');
  `),
  );
  it('applies the role creation', apply());

  // create sample ec2 instance
  it('adds an ec2 instance', done => {
    query(`
      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, subnet_id)
          SELECT '${ubuntuAmiId}', '${instanceType}', '{"name":"${prefix}-vm"}', id
          FROM subnet
          WHERE availability_zone = '${availabilityZone}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-vm'),
          (SELECT id FROM security_group WHERE group_name='default');
      COMMIT;
      `)((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });
  it('applies the created instance', apply());

  it(
    'adds a new codedeploy_application',
    query(`
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationName}', 'Server');
  `),
  );

  it('undo changes', sync());

  it(
    'adds a new codedeploy_application',
    query(`
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationName}', 'Server');
  `),
  );

  it('apply codedeploy_application creation', apply());

  it(
    'check codedeploy_application is available',
    query(
      `
  SELECT * FROM codedeploy_application WHERE name='${applicationName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update application ID',
    query(`
  UPDATE codedeploy_application SET id='fake' WHERE name='${applicationName}'
  `),
  );

  it('applies the application ID update', apply());

  it(
    'checks that application ID has not been been modified',
    query(
      `
  SELECT * FROM codedeploy_application WHERE id='fake' AND name='${applicationName}';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'tries to update the codedeploy_application compute_platform',
    query(`
  UPDATE codedeploy_application SET compute_platform='Lambda' WHERE name='${applicationName}'
  `),
  );

  it('applies the codedeploy_application compute_platform update', apply());

  it(
    'checks that codedeploy_application compute_platform has been modified',
    query(
      `
  SELECT * FROM codedeploy_application WHERE compute_platform='Lambda' AND name='${applicationName}';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the codedeploy module', uninstall(modules));

  it('installs the codedeploy module', install(modules));

  it(
    'delete application',
    query(`
    DELETE FROM codedeploy_application
    WHERE name = '${applicationName}';
  `),
  );
  it('applies the application deletion', apply());*/

  // deployment group testing
  it(
    'adds a new codedeploy_application for deployment',
    query(`
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationNameForDeployment}', 'Server');
  `),
  );

  /*it(
    'adds a new deployment_group',
    query(`
    INSERT INTO codedeploy_deployment_group (application_name, name, role_name)
    VALUES ('${applicationNameForDeployment}', '${deploymentGroupName}', '${roleName}');
  `),
  );

  it('apply codedeploy_deployment_group creation', apply());

  it(
    'check codedeploy_deployment_group is available',
    query(
      `
  SELECT * FROM codedeploy_deployment_group WHERE name='${deploymentGroupName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update the codedeploy_deployment_group tags',
    query(`
  UPDATE codedeploy_deployment_group SET ec2_tag_filters='${ec2FilterTags}' WHERE name='${deploymentGroupName}'
  `),
  );

  it('applies the codedeploy_deployment_group update', apply());

  it(
    'checks that codedeploy_deployment_group has been modified',
    query(
      `
  SELECT * FROM codedeploy_deployment_group WHERE role_name='${roleName}' AND name='${deploymentGroupName}'
  ;
`,
      (res: any[]) => {
        expect(res.length).toBe(1),
          expect(JSON.stringify(res[0].ec2_tag_filters)).toEqual(`${ec2FilterTags}`);
      },
    ),
  );
});*/

  // create application revision
  it(
    'adds a new codedeploy_revision',
    query(`
  INSERT INTO codedeploy_revision (description, application_name, location)
  VALUES ('Codedeploy revision v0', '${applicationNameForDeployment}', '${revisionLocationv0}');
`),
  );
  it('applies the codedeploy_application registration', apply());

  it(
    'check codedeploy_revision is available',
    query(
      `
SELECT * FROM codedeploy_revision WHERE description='Codedeploy revision v0';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  // cleanup
  /*describe('deployment cleanup', () => {
  it(
    'delete deployment group',
    query(`
      DELETE FROM codedeploy_deployment_group
      WHERE name = '${deploymentGroupName}';
    `),
  );*/

  it(
    'delete application',
    query(`
      DELETE FROM codedeploy_application
      WHERE name = '${applicationNameForDeployment}';
    `),
  );

  it('apply codedeploy_deployment_group deletion', apply());
});

/*describe('ec2 cleanup', () => {
  it(
    'deletes all ec2 instances',
    query(`
    BEGIN;
      DELETE FROM general_purpose_volume
      USING instance
      WHERE instance.id = general_purpose_volume.attached_instance_id AND 
        (instance.tags ->> 'name' = '${prefix}-vm');

      DELETE FROM instance
      WHERE tags ->> 'name' = '${prefix}-vm';
    COMMIT;
  `),
  );

  it('applies the instance deletion', apply());
});

describe('delete role', () => {
  it(
    'deletes role',
    query(`
      DELETE FROM iam_role WHERE role_name = '${roleName}';
    `),
  );

  it('applies the role deletion', apply());
});*/

// cleanup
it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));

/*describe('AwsCodedeploy install/uninstall', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `),
  );

  it('installs the codedeploy module', install(modules));

  it('uninstalls the codedeploy module', uninstall(modules));

  it('installs all modules', done => void iasql.install([], dbAlias, 'postgres', true).then(...finish(done)));

  it('uninstalls the codedeploy module', uninstall(['aws_codedeploy']));

  it('installs the codedeploy module', install(['aws_codedeploy']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});*/
