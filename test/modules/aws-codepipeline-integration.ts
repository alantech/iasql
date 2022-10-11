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
const modules = ['aws_codepipeline', 'aws_s3', 'aws_codedeployment'];

const codepipelinePolicyArn = 'arn:aws:iam::aws:policy/AWSCodePipelineFullAccess';
const bucket = `${prefix}-bucket`;

const applicationNameForDeployment = `${prefix}${dbAlias}applicationForDeployment`;
const deploymentGroupName = `${prefix}${dbAlias}deployment_group`;
const region = process.env.AWS_REGION ?? '';
const roleName = `${prefix}-codedeploy-${region}`;

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
          OAuthToken: process.env.GH_PAT,
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
          ApplicationName: 'iasql-codedeploy-example',
          deploymentGroupName: deploymentGroupName,
        },
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
        Service: 'codedeploy.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
});
const codedeployPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeDeployFullAccess';
const deployEC2PolicyArn = 'arn:aws:iam::aws:policy/AmazonEC2FullAccess';

const artifactStore = JSON.stringify({ type: 'S3', location: bucket });

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${process.env.AWS_REGION}';
  `),
  );

  it('installs the codepipeline module', install(modules));

  it(
    'adds a new role',
    query(`
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${prefix}-${dbAlias}', '${assumeServicePolicy}', array['${codepipelinePolicyArn}']);
  `),
  );

  it(
    'add storage s3 endpoint',
    query(`
    INSERT INTO bucket (name) VALUES ('${bucket}')`),
  );

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
    VALUES ('${roleName}', '${codedeployRolePolicy}', array['${codedeployPolicyArn}', '${deployEC2PolicyArn}']);
  `),
  );

  it(
    'adds a new deployment_group',
    query(`
    INSERT INTO codedeploy_deployment_group (application_name, name, role_name)
    VALUES ('${applicationNameForDeployment}', '${deploymentGroupName}', '${roleName}');
  `),
  );

  it('applies the s3 creation', apply());

  it(
    'adds a new pipeline',
    query(`
    INSERT INTO pipeline_declaration (name, service_role_name, stages, artifact_store)
    VALUES ('${prefix}-${dbAlias}', '${prefix}-${dbAlias}', '${stages}', '${artifactStore}');
  `),
  );

  it('apply pipeline creation', apply());

  it(
    'check pipeline is created',
    query(
      `
    SELECT * FROM pipeline_declaration
    WHERE name = '${prefix}-${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
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
    'delete role',
    query(`
    DELETE FROM iam_role
    WHERE role_name = '${prefix}-${dbAlias}' OR role_name='${roleName}';
  `),
  );

  it(
    'delete bucket',
    query(`
    DELETE FROM bucket
    WHERE name = '${bucket}';
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

  it('apply deletions', apply());

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

/*describe('AwsCodepipeline install/uninstall', () => {
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
});*/
