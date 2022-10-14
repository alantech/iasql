import * as iasql from '../../src/services/iasql';
import {
  execComposeDown,
  execComposeUp,
  finish,
  runApply,
  runInstall,
  runQuery,
  runSync,
  runUninstall,
} from '../helpers';

const dbAlias = 'codebuildtest';
const apply = runApply.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const modules = ['aws_codebuild', 'aws_ecr'];

const codebuildPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess';
const cloudwatchLogsArn = 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess';
const pushEcrPolicyArn = 'arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess';
const assumeServicePolicy = JSON.stringify({
  Statement: [
    {
      Effect: 'Allow',
      Principal: {
        Service: 'codebuild.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
  Version: '2012-10-17',
});
const ghUrl = 'https://github.com/iasql/iasql-engine';

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('AwsCodebuild Integration Testing', () => {
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

  it('installs the codebuild module', install(modules));

  it(
    'check generate_put_ecr_image_build_spec with no build args',
    query(
      `
    SELECT generate_put_ecr_image_build_spec('us-west-2', 'latest', 'my-repository', 'myrepouri.com', 'examples/ecs-fargate/prisma/app')
  `,
      (res: any[]) => {
        const buildSpec = `version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin myrepouri.com
  build:
    commands:
      - echo Building the Docker image...
      - docker build -t my-repository examples/ecs-fargate/prisma/app
      - docker tag my-repository:latest myrepouri.com:latest
  post_build:
    commands:
      - echo Pushing the Docker image...
      - docker push myrepouri.com:latest`;
        expect(res.length).toBe(1);
        expect(res[0]['generate_put_ecr_image_build_spec']).toBe(buildSpec);
      },
    ),
  );

  it(
    'check generate_put_ecr_image_build_spec',
    query(
      `
    SELECT generate_put_ecr_image_build_spec('us-west-2', 'latest', 'my-repository', 'myrepouri.com', 'examples/ecs-fargate/prisma/app', array['IASQL_ENV=local', 'SECRET=secret'])
  `,
      (res: any[]) => {
        const buildSpec = `version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin myrepouri.com
  build:
    commands:
      - echo Building the Docker image...
      - docker build --build-arg IASQL_ENV=local --build-arg SECRET=secret -t my-repository examples/ecs-fargate/prisma/app
      - docker tag my-repository:latest myrepouri.com:latest
  post_build:
    commands:
      - echo Pushing the Docker image...
      - docker push myrepouri.com:latest`;
        expect(res.length).toBe(1);
        expect(res[0]['generate_put_ecr_image_build_spec']).toBe(buildSpec);
      },
    ),
  );

  it(
    'adds a new source_credentials_import',
    query(
      `
    INSERT INTO source_credentials_import (token, source_type, auth_type)
    VALUES ('${process.env.GH_PAT}', 'GITHUB', 'PERSONAL_ACCESS_TOKEN')
  `,
      undefined,
      false,
    ),
  );

  it('apply import', apply());

  it(
    'check source_credentials_import is empty',
    query(
      `
    SELECT *
    FROM source_credentials_import
    WHERE source_type = 'GITHUB';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check new source_credentials_list',
    query(
      `
    SELECT *
    FROM source_credentials_list
    WHERE source_type = 'GITHUB';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'delete source_credentials_list',
    query(`
    DELETE FROM source_credentials_list
    WHERE source_type = 'GITHUB';
  `),
  );

  it('apply delete', apply());

  it(
    'check source_credentials_list is empty',
    query(
      `
    SELECT *
    FROM source_credentials_list
    WHERE source_type = 'GITHUB';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'adds a new repository',
    query(`
    INSERT INTO repository (repository_name)
    VALUES ('${dbAlias}');
  `),
  );

  it(
    'adds a new role',
    query(`
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${dbAlias}', '${assumeServicePolicy}', array['${codebuildPolicyArn}', '${cloudwatchLogsArn}', '${pushEcrPolicyArn}']);
  `),
  );

  it(
    'adds a new codebuild_project',
    query(`
    INSERT INTO codebuild_project (project_name, source_type, service_role_name, source_location)
    VALUES ('${dbAlias}', 'GITHUB', '${dbAlias}', '${ghUrl}');
  `),
  );

  it('apply codebuild_project creation', apply());

  it(
    'start build',
    query(`
    INSERT INTO codebuild_build_import (project_name)
    VALUES ('${dbAlias}');
  `),
  );

  it('apply build start', apply());

  it(
    'check build imports is empty',
    query(
      `
    SELECT * FROM codebuild_build_import
    WHERE project_name = '${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check build exists in list',
    query(
      `
    SELECT * FROM codebuild_build_list
    WHERE project_name = '${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the codebuild module', uninstall(modules));

  it('installs the codebuild module', install(modules));

  it(
    'check build exists in list',
    query(
      `
    SELECT * FROM codebuild_build_list
    WHERE project_name = '${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'delete build',
    query(`
    DELETE FROM codebuild_build_list
    WHERE project_name = '${dbAlias}';
  `),
  );

  it(
    'delete project',
    query(`
    DELETE FROM codebuild_project
    WHERE project_name = '${dbAlias}';
  `),
  );

  it(
    'delete repository',
    query(`
    DELETE FROM repository
    WHERE repository_name = '${dbAlias}';
  `),
  );

  it(
    'delete role',
    query(`
    DELETE FROM iam_role
    WHERE role_name = '${dbAlias}';
  `),
  );

  it('apply deletions', apply());

  it(
    'check build list is empty',
    query(
      `
    SELECT * FROM codebuild_build_list
    WHERE project_name = '${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check role is empty',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check repository is empty',
    query(
      `
    SELECT *
    FROM repository
    WHERE repository_name = '${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check codebuild_project is empty',
    query(
      `
    SELECT *
    FROM codebuild_project
    WHERE project_name = '${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('AwsCodebuild install/uninstall', () => {
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

  it('installs the codebuild module', install(modules));

  it('uninstalls the codebuild module', uninstall(modules));

  it('installs all modules', done => void iasql.install([], dbAlias, 'postgres', true).then(...finish(done)));

  it(
    'uninstalls the codebuild + ecs module',
    uninstall(['aws_codebuild', 'aws_ecs_fargate', 'aws_ecs_simplified']),
  );

  it('installs the codebuild module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
