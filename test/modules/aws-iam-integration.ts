import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'iamtest';
const region = process.env.AWS_REGION ?? 'barf';
const awsServiceRoleName = 'AWSServiceRoleForSupport';
const taskRoleName = `${prefix}${dbAlias}task-${region}`;
const taskPolicyArn = 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy';
const lambdaRoleName = `${prefix}${dbAlias}lambda-${region}`;
const ec2RoleName = `${prefix}${dbAlias}ec2-${region}`;
const anotherRoleName = `${prefix}${dbAlias}another-${region}`;
const newRoleName = `${prefix}${dbAlias}new-${region}`;
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
const attachAssumeEc2Policy = JSON.stringify({
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
const attachAnotherPolicy = JSON.stringify({
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "sts:AssumeRoleWithSAML",
        "sts:TagSession"
      ],
      "Effect": "Allow",
      "Condition": {
        "StringEquals": {
          "SAML:aud": "https://signin.aws.amazon.com/saml"
        }
      },
      "Principal": {
        "Federated": "arn:aws:iam::123456789123:saml-provider/AWSSSO_01c318b42a2dcb07_DO_NOT_DELETE"
      }
    }
  ]
});
const attachNewPolicy = JSON.stringify({
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Effect": "Allow",
      "Principal": {
        "Service": [
          "airflow.amazonaws.com",
          "airflow-env.amazonaws.com"
        ]
      }
    }
  ]
});


const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_iam'];

jest.setTimeout(480000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('IAM Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${region}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

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

      INSERT INTO role (role_name, assume_role_policy_document)
      VALUES ('${ec2RoleName}', '${attachAssumeEc2Policy}');

      INSERT INTO role (role_name, assume_role_policy_document)
      VALUES ('${anotherRoleName}', '${attachAnotherPolicy}');

      INSERT INTO role (role_name, assume_role_policy_document)
      VALUES ('${newRoleName}', '${attachNewPolicy}');
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

  it('check a new role addition', query(`
    SELECT *
    FROM role
    WHERE role_name = '${ec2RoleName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check a new role addition', query(`
    SELECT *
    FROM role
    WHERE role_name = '${anotherRoleName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check a new role addition', query(`
    SELECT *
    FROM role
    WHERE role_name = '${newRoleName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the role additions', apply());

  it('tries to update a autogenerated field', query(`
    UPDATE role SET arn = 'dummy' WHERE role_name = '${taskRoleName}';
  `));

  it('check preview', query(`
    SELECT *
    FROM iasql_preview_apply();
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check preview', query(`
    SELECT *
    FROM iasql_preview_apply();
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check preview', query(`
    SELECT *
    FROM iasql_preview_apply();
  `, (res: any[]) => expect(res.length).toBe(1)));

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

  it('tries to update ec2 policy field', query(`
    UPDATE role SET assume_role_policy_document = '${attachAssumeLambdaPolicy}' WHERE role_name = '${ec2RoleName}';
  `));

  it('applies change', apply());

  it('tries to restore ec2 policy field', query(`
    UPDATE role SET assume_role_policy_document = '${attachAssumeEc2Policy}' WHERE role_name = '${ec2RoleName}';
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

  it('deletes the role', query(`
    DELETE FROM role
    WHERE role_name = '${ec2RoleName}';
  `));

  it('deletes the role', query(`
    DELETE FROM role
    WHERE role_name = '${anotherRoleName}';
  `));

  it('deletes the role', query(`
    DELETE FROM role
    WHERE role_name = '${newRoleName}';
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

  it('check deletes the role', query(`
    SELECT *
    FROM role
    WHERE role_name = '${ec2RoleName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check deletes the role', query(`
    SELECT *
    FROM role
    WHERE role_name = '${anotherRoleName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check deletes the role', query(`
    SELECT *
    FROM role
    WHERE role_name = '${newRoleName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('creates a lot of similar roles to try to hit the rate-limiter', query(`
    INSERT INTO role (role_name, assume_role_policy_document)
    VALUES ${Array(100)
      .fill('')
      .map((_, i) => `('${lambdaRoleName}-${i}', '${attachAssumeLambdaPolicy}')`)
      .join(', ')};
  `));

  it('creates these things', apply());

  it('uninstalls the iam module', uninstall(modules));

  it('installs the iam module', install(modules));

  it('deletes all of this similar roles', query(`
    DELETE FROM role
    WHERE role_name in (${Array(100)
      .fill('')
      .map((_, i) => `'${lambdaRoleName}-${i}'`)
      .join(', ')});
  `));

  it('deletes these things', apply());

  describe('AWS service roles', () => {
    it('check service role', query(`
      SELECT *
      FROM role
      WHERE role_name = '${awsServiceRoleName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('tries to update aws service role field', query(`
      UPDATE role SET arn = 'dummy' WHERE role_name = '${awsServiceRoleName}';
    `));

    it('applies change which will undo it', apply());

    it('check update aws service role (noop)', query(`
      SELECT *
      FROM role
      WHERE role_name = '${awsServiceRoleName}' AND arn = 'dummy';
    `, (res: any[]) => expect(res.length).toBe(0)));

    it('tries to delete an aws service role', query(`
      DELETE FROM role WHERE role_name = '${awsServiceRoleName}';
    `));

    it('check delete aws service role before apply', query(`
      SELECT *
      FROM role
      WHERE role_name = '${awsServiceRoleName}';
    `, (res: any[]) => expect(res.length).toBe(0)));

    it('applies change which will undo it', apply());

    it('check delete aws service role (noop)', query(`
      SELECT *
      FROM role
      WHERE role_name = '${awsServiceRoleName}';
    `, (res: any[]) => expect(res.length).toBe(1)));
  })

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('IAM install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the IAM module', install(modules));

  it('uninstalls the IAM module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the IAM module', uninstall(['aws_ec2', 'aws_ec2_metadata', 'aws_ecs_fargate', 'aws_lambda','aws_iam']));

  it('installs the IAM module', install(modules));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
