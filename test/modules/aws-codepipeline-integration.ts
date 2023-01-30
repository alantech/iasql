import { EC2 } from '@aws-sdk/client-ec2';

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
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'codepipelinetest';

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
// codepipeline has a more limited region list
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
const modules = ['aws_codepipeline', 'aws_s3', 'aws_codedeploy'];

const codecommitPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeCommitFullAccess';
const codebuildPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess';
const codepipelinePolicyArn = 'arn:aws:iam::aws:policy/AWSCodePipeline_FullAccess';
const s3PolicyArn = 'arn:aws:iam::aws:policy/AmazonS3FullAccess';

const bucket = `${prefix}-bucket`;
const testLambdaBucketName = `${prefix}-lambda-bucket`;

const applicationNameForDeployment = `${prefix}${dbAlias}applicationForDeployment`;
const deploymentGroupName = `${prefix}${dbAlias}deployment_group`;
const nonDefaultRegion = 'us-east-1';
const codeDeployRoleName = `${prefix}-codedeploy-${region}`;
const codePipelineRoleName = `${prefix}-codepipeline-${region}`;
const codePipelineCfRoleName = `${prefix}-codepipeline-cf-${region}`;
const ec2RoleName = `${prefix}-codedeploy-ec2-${region}`;
const cloudformationRoleName = `${prefix}-codedeploy-cloudformation-${region}`;
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

// stages for lambda
const lambdaStages = JSON.stringify([
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
          Repo: 'iasql-code-example-lambda',
          Branch: 'main',
          OAuthToken: `${process.env.GH_PAT}`,
          OutputArtifactFormat: 'CODE_ZIP',
        },
        outputArtifacts: [
          {
            name: 'SourceArtifact',
          },
        ],
      },
    ],
  },
  {
    name: 'Build',
    actions: [
      {
        actionTypeId: {
          category: 'Build',
          owner: 'AWS',
          provider: 'CodeBuild',
          version: '1',
        },
        configuration: {
          ProjectName: 'build-code-example-lambda',
          EnvironmentVariables: `[{"TEST_LAMBDA_BUCKET_NAME": "${testLambdaBucketName}"}]`,
        },
        inputArtifacts: [
          {
            name: 'SourceArtifact',
          },
        ],
        name: 'Build',
        namespace: 'BuildVariables',
        outputArtifacts: [
          {
            name: 'BuildArtifact',
          },
        ],
        region: region,
        runOrder: 1,
      },
    ],
  },
  {
    name: 'Deploy',
    actions: [
      {
        actionTypeId: {
          category: 'Deploy',
          owner: 'AWS',
          provider: 'CloudFormation',
          version: '1',
        },
        configuration: {
          ActionMode: 'CHANGE_SET_REPLACE',
          Capabilities: 'CAPABILITY_IAM',
          ChangeSetName: 'aws-codepipeline-lambda-changeset-example',
          RoleArn: cloudformationRoleName,
          StackName: 'aws-codepipeline-lambda-stack-example',
          TemplatePath: 'BuildArtifact::outputTemplate.yaml',
        },
        inputArtifacts: [
          {
            name: 'BuildArtifact',
          },
        ],
        name: 'Deploy',
        namespace: 'DeployVariables',
        outputArtifacts: [],
        region: region,
        runOrder: 1,
      },
    ],
  },
]);

const customLambdaPolicy = JSON.stringify({
  Statement: [
    {
      Action: ['iam:PassRole'],
      Resource: '*',
      Effect: 'Allow',
      Condition: {
        StringEqualsIfExists: {
          'iam:PassedToService': [
            'cloudformation.amazonaws.com',
            'elasticbeanstalk.amazonaws.com',
            'ec2.amazonaws.com',
            'ecs-tasks.amazonaws.com',
          ],
        },
      },
    },
    {
      Action: [
        'codecommit:CancelUploadArchive',
        'codecommit:GetBranch',
        'codecommit:GetCommit',
        'codecommit:GetRepository',
        'codecommit:GetUploadArchiveStatus',
        'codecommit:UploadArchive',
      ],
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: [
        'codedeploy:CreateDeployment',
        'codedeploy:GetApplication',
        'codedeploy:GetApplicationRevision',
        'codedeploy:GetDeployment',
        'codedeploy:GetDeploymentConfig',
        'codedeploy:RegisterApplicationRevision',
      ],
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: ['codestar-connections:UseConnection'],
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: [
        'elasticbeanstalk:*',
        'ec2:*',
        'elasticloadbalancing:*',
        'autoscaling:*',
        'cloudwatch:*',
        's3:*',
        'sns:*',
        'cloudformation:*',
        'rds:*',
        'sqs:*',
        'ecs:*',
      ],
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: ['lambda:InvokeFunction', 'lambda:ListFunctions'],
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: [
        'opsworks:CreateDeployment',
        'opsworks:DescribeApps',
        'opsworks:DescribeCommands',
        'opsworks:DescribeDeployments',
        'opsworks:DescribeInstances',
        'opsworks:DescribeStacks',
        'opsworks:UpdateApp',
        'opsworks:UpdateStack',
      ],
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: [
        'cloudformation:CreateStack',
        'cloudformation:DeleteStack',
        'cloudformation:DescribeStacks',
        'cloudformation:UpdateStack',
        'cloudformation:CreateChangeSet',
        'cloudformation:DeleteChangeSet',
        'cloudformation:DescribeChangeSet',
        'cloudformation:ExecuteChangeSet',
        'cloudformation:SetStackPolicy',
        'cloudformation:ValidateTemplate',
      ],
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: [
        'codebuild:BatchGetBuilds',
        'codebuild:StartBuild',
        'codebuild:BatchGetBuildBatches',
        'codebuild:StartBuildBatch',
      ],
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Effect: 'Allow',
      Action: [
        'devicefarm:ListProjects',
        'devicefarm:ListDevicePools',
        'devicefarm:GetRun',
        'devicefarm:GetUpload',
        'devicefarm:CreateUpload',
        'devicefarm:ScheduleRun',
      ],
      Resource: '*',
    },
    {
      Effect: 'Allow',
      Action: [
        'servicecatalog:ListProvisioningArtifacts',
        'servicecatalog:CreateProvisioningArtifact',
        'servicecatalog:DescribeProvisioningArtifact',
        'servicecatalog:DeleteProvisioningArtifact',
        'servicecatalog:UpdateProduct',
      ],
      Resource: '*',
    },
    {
      Effect: 'Allow',
      Action: ['cloudformation:ValidateTemplate'],
      Resource: '*',
    },
    {
      Effect: 'Allow',
      Action: ['ecr:DescribeImages'],
      Resource: '*',
    },
    {
      Effect: 'Allow',
      Action: ['states:DescribeExecution', 'states:DescribeStateMachine', 'states:StartExecution'],
      Resource: '*',
    },
    {
      Effect: 'Allow',
      Action: ['appconfig:StartDeployment', 'appconfig:StopDeployment', 'appconfig:GetDeployment'],
      Resource: '*',
    },
  ],
  Version: '2012-10-17',
});

// buggy stages
const buggyStages = JSON.stringify([
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
          Repo: 'iasql-codedeploy-nonexisting-example',
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
const globalIamPolicyArn = 'arn:aws:iam::aws:policy/IAMFullAccess';
const cloudformationPolicyArn = 'arn:aws:iam::aws:policy/AWSCloudFormationFullAccess';

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

const cloudformationRolePolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Sid: '',
      Effect: 'Allow',
      Principal: {
        Service: 'cloudformation.amazonaws.com',
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

jest.setTimeout(960000);
beforeAll(async () => {
  const availabilityZones =
    (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone = availabilityZones.pop() ?? '';
  const instanceTypesByAz1 = await getInstanceTypeOffering([availabilityZone]);
  instanceType = instanceTypesByAz1.InstanceTypeOfferings?.pop()?.InstanceType ?? '';

  await execComposeUp();
});
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('AwsCodepipeline Integration Testing', () => {
  it('creates a new test db with the same name', done => {
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

  it('installs the codepipeline module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new role',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${codePipelineRoleName}', '${assumeServicePolicy}', array['${codepipelinePolicyArn}', '${s3PolicyArn}', '${codedeployPolicyArn}', '${globalIamPolicyArn}', '${cloudformationPolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new role for lambda pipeline',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${codePipelineCfRoleName}', '${assumeServicePolicy}', array['${codepipelinePolicyArn}', '${s3PolicyArn}', '${codecommitPolicyArn}', '${codebuildPolicyArn}', '${codedeployPolicyArn}', '${globalIamPolicyArn}', '${cloudformationPolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new ec2 role',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${cloudformationRoleName}', '${cloudformationRolePolicy}', array['${codedeployPolicyArn}', '${globalIamPolicyArn}', '${cloudformationPolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new ec2 role for cloudformation',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${ec2RoleName}', '${ec2RolePolicy}', array['${deployEC2PolicyArn}', '${ssmPolicyArn}', '${codedeployPolicyArn}', '${s3PolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new codedeploy role',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${codeDeployRoleName}', '${codedeployRolePolicy}', array['${codedeployPolicyArn}', '${deployEC2PolicyArn}', '${s3PolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'add storage s3 endpoint',
    query(
      `
    INSERT INTO bucket (name) VALUES ('${bucket}')`,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'add storage s3 endpoint for lambda',
    query(
      `
    INSERT INTO bucket (name) VALUES ('${testLambdaBucketName}')`,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('apply creation of resources', commit());

  // testing of lambda deployment function
  it('starts a transaction', begin());

  it(
    'adds a new pipeline',
    query(
      `
    INSERT INTO pipeline_declaration (name, service_role_name, stages, artifact_store)
    VALUES ('${prefix}-lambda-${dbAlias}', '${codePipelineCfRoleName}', '${lambdaStages}', '${artifactStore}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply pipeline creation', commit());

  it(
    'check pipeline is created',
    query(
      `
    SELECT * FROM pipeline_declaration
    WHERE name = '${prefix}-${dbAlias}-lambda';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // testing of ec2 pipeline
  it('starts a transaction', begin());

  it(
    'adds a new security group',
    query(
      `  
    INSERT INTO security_group (description, group_name)
    VALUES ('CodedeploySecurity Group', '${sgGroupName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds security group rules',
    query(
      `
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

  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the security group and rules creation', commit());

  // create sample ec2 instance
  it('starts a transaction', begin());

  it('adds an ec2 instance', done => {
    query(
      `
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
      `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('applies the created instance', commit());

  it('starts a transaction', begin());

  it(
    'adds a new codedeploy_application for deployment',
    query(
      `
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationNameForDeployment}', 'Server');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new deployment_group',
    query(
      `
    INSERT INTO codedeploy_deployment_group (application_id, name, role_name, ec2_tag_filters)
    VALUES ((SELECT id FROM codedeploy_application WHERE name = '${applicationNameForDeployment}'), '${deploymentGroupName}', '${codeDeployRoleName}', '${ec2FilterTags}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the deployment group creation', commit());

  it('starts a transaction', begin());

  it(
    'adds a new buggy pipeline',
    query(
      `
    INSERT INTO pipeline_declaration (name, service_role_name, stages, artifact_store)
    VALUES ('${prefix}-buggy-${dbAlias}', '${codePipelineRoleName}', '${buggyStages}', '${artifactStore}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply buggy pipeline creation', commit());

  it(
    'check pipeline is created',
    query(
      `
    SELECT * FROM pipeline_declaration
    WHERE name = '${prefix}-buggy-${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a new pipeline',
    query(
      `
    INSERT INTO pipeline_declaration (name, service_role_name, stages, artifact_store)
    VALUES ('${prefix}-${dbAlias}', '${codePipelineRoleName}', '${stages}', '${artifactStore}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply pipeline creation', commit());

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

  it('should fail when changing the region', () => {
    try {
      query(
        `
      UPDATE pipeline_declaration SET region='${nonDefaultRegion} WHERE name='${prefix}-${dbAlias}');
      `,
        undefined,
        true,
        () => ({ username, password }),
      );
    } catch (e) {
      expect(e).toBeTruthy;
    }
  });

  it('uninstalls the codepipeline module', uninstall(modules));

  it('installs the codepipeline module', install(modules));

  it('starts a transaction', begin());

  it(
    'delete pipeline',
    query(
      `
    DELETE FROM pipeline_declaration
    WHERE name IN ('${prefix}-${dbAlias}', '${prefix}-buggy-${dbAlias}', '${prefix}-lambda-${dbAlias}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'delete deployment group',
    query(
      `
      DELETE FROM codedeploy_deployment_group
      WHERE name = '${deploymentGroupName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'delete application',
    query(
      `
      DELETE FROM codedeploy_application
      WHERE name = '${applicationNameForDeployment}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  describe('ec2 cleanup', () => {
    it(
      'deletes all ec2 instances',
      query(
        `
      BEGIN;
        DELETE FROM general_purpose_volume
        USING instance
        WHERE instance.id = general_purpose_volume.attached_instance_id AND 
          (instance.tags ->> 'name' = '${instanceTag}');
  
        DELETE FROM instance
        WHERE tags ->> 'name' = '${instanceTag}';
      COMMIT;
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the instance deletion', commit());
  });

  // deletes policy

  it('starts a transaction', begin());

  it(
    'delete role',
    query(
      `
    DELETE FROM iam_role
    WHERE role_name IN ('${codePipelineRoleName}', '${codePipelineCfRoleName}', '${codeDeployRoleName}', '${ec2RoleName}', '${cloudformationRoleName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'cleans up the bucket',
    query(
      `
        DELETE FROM bucket_object WHERE bucket_name='${bucket}' OR bucket_name='${testLambdaBucketName}'
      `,
      undefined,
      true,
      () => ({
        username,
        password,
      }),
    ),
  );

  it(
    'delete bucket',
    query(
      `
    DELETE FROM bucket
    WHERE name = '${bucket}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply deletions', commit());

  describe('delete security groups and rules', () => {
    it('starts a transaction', begin());

    it(
      'deletes security group rules',
      query(
        `
        DELETE FROM security_group_rule WHERE description='${prefix}codedeploy_rule_ssh' or description='${prefix}codedeploy_rule_http' or description='${prefix}codedeploy_rule_egress';
      `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it(
      'deletes security group',
      query(
        `
        DELETE FROM security_group WHERE group_name = '${sgGroupName}';
      `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the security group deletion', commit());
  });

  it('starts a transaction', begin());

  it('apply delete', commit());

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
    WHERE role_name = '${codePipelineRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('AwsCodepipeline install/uninstall', () => {
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

  it('installs the codepipeline module', install(modules));

  it('uninstalls the codepipeline module', uninstall(modules));

  it('installs all modules', installAll());

  it('uninstalls the codepipeline module', uninstall(['aws_codepipeline']));

  it('installs the codepipeline module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
