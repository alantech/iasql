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
const dbAlias = 'codepipelinetest';
const apply = runApply.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const modules = ['aws_codepipeline', 'aws_s3', 'aws_codedeploy'];

const codepipelinePolicyArn = 'arn:aws:iam::aws:policy/AWSCodePipelineFullAccess';
const s3PolicyArn = 'arn:aws:iam::aws:policy/AmazonS3FullAccess';

const bucket = `${prefix}-bucket`;

const applicationNameForDeployment = `${prefix}${dbAlias}applicationForDeployment`;
const deploymentGroupName = `${prefix}${dbAlias}deployment_group`;
const region = 'us-east-1'; // we need to force to us-east-1 due to issue #1398
const roleName = `${prefix}-codedeploy-${region}`;
const ec2RoleName = `${prefix}-codedeploy-ec2-${region}`;
const sgGroupName = `${prefix}sgcodedeploy`;

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

const assumeServicePolicy = JSON.stringify({
  Statement: [
    {
      Effect: 'Allow',
      Principal: {
        Service: 'codepipeline.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
  Version: '2012-10-17',
});

const stages = JSON.stringify([
  {
    name: 'Source',
    actions: [
      {
        name: 'SourceAction',
        actionTypeId: {
          category: 'Source',
          owner: 'ThirdParty',
          version: '1',
          provider: 'GitHub',
        },
        configuration: {
          Owner: 'iasql',
          Repo: 'iasql-codedeploy-example',
          Branch: 'main',
          OAuthToken: `${process.env.GH_PAT}`,
        },
        outputArtifacts: [
          {
            name: 'Source',
          },
        ],
      },
    ],
  },
  {
    name: 'Deploy',
    actions: [
      {
        name: 'DeployApp',
        actionTypeId: {
          category: 'Deploy',
          owner: 'AWS',
          version: '1',
          provider: 'CodeDeploy',
        },
        configuration: {
          ApplicationName: `${prefix}${dbAlias}applicationForDeployment`,
          DeploymentGroupName: deploymentGroupName,
        },
        inputArtifacts: [
          {
            name: 'Source',
          },
        ],
      },
    ],
  },
]);

const codedeployRolePolicy = JSON.stringify({
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
const codedeployPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeDeployFullAccess';
const deployEC2PolicyArn = 'arn:aws:iam::aws:policy/AmazonEC2FullAccess';

const ec2RolePolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Sid: '',
      Effect: 'Allow',
      Principal: {
        Service: 'ec2.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
});

const artifactStore = JSON.stringify({ type: 'S3', location: bucket });
const ubuntuAmiId =
  'resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id';
const instanceTag = `${prefix}-codedeploy-vm`;
const ssmPolicyArn = 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore';

const ec2FilterTags = JSON.stringify([
  {
    Type: 'KEY_AND_VALUE',
    Key: 'name',
    Value: `${instanceTag}`,
  },
]);

let availabilityZone: string;
let instanceType: string;

jest.setTimeout(360000);
beforeAll(async () => {
  const availabilityZones =
    (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone = availabilityZones.pop() ?? '';
  const instanceTypesByAz1 = await getInstanceTypeOffering([availabilityZone]);
  instanceType = instanceTypesByAz1.InstanceTypeOfferings?.pop()?.InstanceType ?? '';

  await execComposeUp();
});
afterAll(async () => await execComposeDown());

describe('AwsCodepipeline Integration Testing', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `),
  );

  it('installs the codepipeline module', install(modules));

  it(
    'adds a new role',
    query(`
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${prefix}-${dbAlias}', '${assumeServicePolicy}', array['${codepipelinePolicyArn}', '${s3PolicyArn}', '${codedeployPolicyArn}']);
  `),
  );

  it(
    'adds a new ec2 role',
    query(`
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${ec2RoleName}', '${ec2RolePolicy}', array['${deployEC2PolicyArn}', '${ssmPolicyArn}', '${codedeployPolicyArn}', '${s3PolicyArn}']);
  `),
  );

  it(
    'add storage s3 endpoint',
    query(`
    INSERT INTO bucket (name) VALUES ('${bucket}')`),
  );

  it(
    'adds a new security group',
    query(`  
    INSERT INTO security_group (description, group_name)
    VALUES ('CodedeploySecurity Group', '${sgGroupName}');
  `),
  );

  it(
    'adds security group rules',
    query(`
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT false, 'tcp', 22, 22, '0.0.0.0/0', '${prefix}codedeploy_rule_ssh', id
    FROM security_group
    WHERE group_name = '${sgGroupName}';
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT false, 'tcp', 80, 80, '0.0.0.0/0', '${prefix}codedeploy_rule_http', id
    FROM security_group
    WHERE group_name = '${sgGroupName}';
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT true, 'tcp', 1, 65335, '0.0.0.0/0', '${prefix}codedeploy_rule_egress', id
    FROM security_group
    WHERE group_name = '${sgGroupName}';

  `),
  );
  it('applies the security group and rules creation', apply());

  // create sample ec2 instance
  it('adds an ec2 instance', done => {
    query(`
      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, subnet_id, role_name, user_data)
          SELECT '${ubuntuAmiId}', '${instanceType}', '{"name":"${instanceTag}"}', id, '${ec2RoleName}', (SELECT generate_codedeploy_agent_install_script('${region}', 'ubuntu'))
          FROM subnet
          WHERE availability_zone = '${availabilityZone}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${instanceTag}'),
          (SELECT id FROM security_group WHERE group_name='${sgGroupName}');
      COMMIT;
      `)((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('applies the created instance', apply());

  it(
    'adds a new codedeploy_application for deployment',
    query(`
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationNameForDeployment}', 'Server');
  `),
  );

  it(
    'adds a new codedeploy role',
    query(`
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${roleName}', '${codedeployRolePolicy}', array['${codedeployPolicyArn}', '${deployEC2PolicyArn}', '${codepipelinePolicyArn}', '${s3PolicyArn}']);
  `),
  );

  it(
    'adds a new deployment_group',
    query(`
    INSERT INTO codedeploy_deployment_group (application_name, name, role_name, ec2_tag_filters)
    VALUES ('${applicationNameForDeployment}', '${deploymentGroupName}', '${roleName}', '${ec2FilterTags}');
  `),
  );

  it('applies the deployment group creation', apply());

  it(
    'adds a new pipeline',
    query(
      `
    INSERT INTO pipeline_declaration (name, service_role_name, stages, artifact_store)
    VALUES ('${prefix}-${dbAlias}', '${prefix}-${dbAlias}', '${stages}', '${artifactStore}');
  `,
      undefined,
      false,
    ),
  );

  it('apply pipeline creation', apply());

  it(
    'check pipeline is created',
    query(
      `
    SELECT * FROM pipeline_declaration
    WHERE name = '${prefix}-${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the codepipeline module', uninstall(modules));

  it('installs the codepipeline module', install(modules));

  it(
    'delete pipeline',
    query(`
    DELETE FROM pipeline_declaration
    WHERE name = '${prefix}-${dbAlias}';
  `),
  );

  it(
    'delete deployment group',
    query(`
      DELETE FROM codedeploy_deployment_group
      WHERE name = '${deploymentGroupName}';
    `),
  );

  it(
    'delete application',
    query(`
      DELETE FROM codedeploy_application
      WHERE name = '${applicationNameForDeployment}';
    `),
  );

  describe('ec2 cleanup', () => {
    it(
      'deletes all ec2 instances',
      query(`
      BEGIN;
        DELETE FROM general_purpose_volume
        USING instance
        WHERE instance.id = general_purpose_volume.attached_instance_id AND 
          (instance.tags ->> 'name' = '${instanceTag}');
  
        DELETE FROM instance
        WHERE tags ->> 'name' = '${instanceTag}';
      COMMIT;
    `),
    );

    it('applies the instance deletion', apply());
  });

  it(
    'delete role',
    query(`
    DELETE FROM iam_role
    WHERE role_name = '${prefix}-${dbAlias}' OR role_name='${roleName}' OR role_name='${ec2RoleName}';
  `),
  );

  it('cleans up the bucket', query(`SELECT * FROM s3_clean_bucket('${bucket}')`));

  it(
    'delete bucket',
    query(`
    DELETE FROM bucket
    WHERE name = '${bucket}';
  `),
  );

  it('apply deletions', apply());

  describe('delete security groups and rules', () => {
    it(
      'deletes security group rules',
      query(`
        DELETE FROM security_group_rule WHERE description='${prefix}codedeploy_rule_ssh' or description='${prefix}codedeploy_rule_http' or description='${prefix}codedeploy_rule_egress';
      `),
    );

    it(
      'deletes security group',
      query(`
        DELETE FROM security_group WHERE group_name = '${sgGroupName}';
      `),
    );

    it('applies the security group deletion', apply());
  });

  it('apply delete', apply());

  it(
    'check pipeline list is empty',
    query(
      `
    SELECT * FROM pipeline_declaration
    WHERE name = '${prefix}-${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check role list is empty',
    query(
      `
    SELECT * FROM iam_role
    WHERE role_name = '${prefix}-${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('AwsCodepipeline install/uninstall', () => {
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

  it('installs the codepipeline module', install(modules));

  it('uninstalls the codepipeline module', uninstall(modules));

  it('installs all modules', done => void iasql.install([], dbAlias, 'postgres', true).then(...finish(done)));

  it('uninstalls the codepipeline module', uninstall(['aws_codepipeline']));

  it('installs the codepipeline module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
