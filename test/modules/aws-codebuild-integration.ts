import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  runCommit,
  runInstall,
  runQuery,
  runUninstall,
} from '../helpers';

const dbAlias = 'codebuildtest';
const commit = runCommit.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const region = defaultRegion();
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

let username: string, password: string;

describe('AwsCodebuild Integration Testing', () => {
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
    SELECT * FROM iasql_begin();
    INSERT INTO source_credentials_import (token, source_type, auth_type)
    VALUES ('${process.env.GH_PAT}', 'GITHUB', 'PERSONAL_ACCESS_TOKEN')
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('apply import', commit());

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
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM source_credentials_list
    WHERE source_type = 'GITHUB';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply delete', commit());

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
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO repository (repository_name)
    VALUES ('${dbAlias}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new role',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${dbAlias}', '${assumeServicePolicy}', array['${codebuildPolicyArn}', '${cloudwatchLogsArn}', '${pushEcrPolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new codebuild_project with codepipeline type',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO codebuild_project (project_name, source_type, service_role_name)
    VALUES ('${dbAlias}-codepipeline', 'CODEPIPELINE', '${dbAlias}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply codebuild_project codepipeline creation', commit());

  it(
    'check new project exists',
    query(
      `
    SELECT *
    FROM codebuild_project
    WHERE project_name='${dbAlias}-codepipeline';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'deletes codebuild codepipeline project',
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM codebuild_project WHERE project_name='${dbAlias}-codepipeline';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new codebuild_project',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO codebuild_project (project_name, source_type, service_role_name, source_location)
    VALUES ('${dbAlias}', 'GITHUB', '${dbAlias}', '${ghUrl}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply codebuild_project creation', commit());

  it(
    'start and wait for build',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO codebuild_build_import (project_name)
    VALUES ('${dbAlias}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply build start', commit());

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
    'check failed build exists in list',
    query(
      `
    SELECT * FROM codebuild_build_list
    WHERE project_name = '${dbAlias}' and build_status = 'FAILED';
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
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM codebuild_build_list
    WHERE project_name = '${dbAlias}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'delete project',
    query(
      `
    DELETE FROM codebuild_project
    WHERE project_name = '${dbAlias}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'delete repository',
    query(
      `
    DELETE FROM repository
    WHERE repository_name = '${dbAlias}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'delete role',
    query(
      `
    DELETE FROM iam_role
    WHERE role_name = '${dbAlias}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply deletions', commit());

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
