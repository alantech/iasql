import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'iamtest';
const region = process.env.AWS_REGION ?? 'barf';
const taskRoleName = `${prefix}${dbAlias}task-${region}`;
const taskPolicyArn = 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy';
const lambdaRoleName = `${prefix}${dbAlias}lambda-${region}`;
const attachAssumeTaskPolicy= JSON.stringify({
  "Version": "2012-10-17",
  "Statement": [
      {
          "Sid": "",
          "Effect": "Allow",
          "Principal": {
              "Service": "ecs-tasks.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
      }
  ]
});
const attachAssumeLambdaPolicy = JSON.stringify({
  "Version": "2012-10-17",
  "Statement": [
      {
          "Effect": "Allow",
          "Principal": {
              "Service": "lambda.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
      }
  ]
});
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_iam'];

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('IAM Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    region,
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the iam module', install(modules));

  it('adds a new role', query(`
    INSERT INTO role (role_name, assume_role_policy_document)
    VALUES ('${lambdaRoleName}', '${attachAssumeLambdaPolicy}');
  `));
  
  it('undo changes', sync());

  it('check undo a new role addition', query(`
    SELECT *
    FROM role
    WHERE role_name = '${lambdaRoleName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new role', query(`
    INSERT INTO role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${taskRoleName}', '${attachAssumeTaskPolicy}', array['${taskPolicyArn}']);
  `));

  it('adds a new role', query(`
    BEGIN;
      INSERT INTO role (role_name, assume_role_policy_document)
      VALUES ('${lambdaRoleName}', '${attachAssumeLambdaPolicy}');
    COMMIT;
  `));

  it('check a new role addition', query(`
    SELECT *
    FROM role
    WHERE role_name = '${taskRoleName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check a new role addition', query(`
    SELECT *
    FROM role
    WHERE role_name = '${lambdaRoleName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the role additions', apply());

  it('tries to update a autogenerated field', query(`
    UPDATE role SET arn = 'dummy' WHERE role_name = '${taskRoleName}';
  `));

  it('applies change which will undo it', apply());

  it('check update role (noop)', query(`
    SELECT *
    FROM role
    WHERE role_name = '${taskRoleName}' AND arn = 'dummy';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('tries to update a role description', query(`
    UPDATE role SET description = 'description' WHERE role_name = '${taskRoleName}';
  `));

  it('applies change', apply());

  it('check update role description', query(`
    SELECT *
    FROM role
    WHERE role_name = '${taskRoleName}' AND description = 'description';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('uninstalls the iam module', uninstall(modules));

  it('installs the iam module', install(modules));

  it('deletes the role', query(`
    DELETE FROM role
    WHERE role_name = '${taskRoleName}';
  `));

  it('deletes the role', query(`
    DELETE FROM role
    WHERE role_name = '${lambdaRoleName}';
  `));

  it('applies the change', apply());

  it('check deletes the role', query(`
    SELECT *
    FROM role
    WHERE role_name = '${taskRoleName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check deletes the role', query(`
    SELECT *
    FROM role
    WHERE role_name = '${lambdaRoleName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('IAM install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'us-east-1', // Share region with common tests
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the IAM module', install(modules));

  it('uninstalls the IAM module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.dbUser,
    true).then(...finish(done)));

  it('uninstalls the IAM module', uninstall(['aws_ecs_fargate', 'aws_iam']));

  it('installs the IAM module', install(modules));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
