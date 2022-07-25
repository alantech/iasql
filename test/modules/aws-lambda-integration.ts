import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'lambdatest';
const lambdaFunctionName = `${prefix}${dbAlias}`;
// Base64 for zip file with the following code:
// exports.handler =  async function(event, context) {
//   console.log("EVENT: \n" + JSON.stringify(event, null, 2))
//   return context.logStreamName
// }
const lambdaFunctionCode = 'UEsDBBQAAAAIADqB9VRxjjIufQAAAJAAAAAIABwAaW5kZXguanNVVAkAAzBe2WIwXtlidXgLAAEE9QEAAAQUAAAANcyxDoIwEIDhnae4MNFIOjiaOLI41AHj5NLUA5scV3K9Gojx3ZWB8R++H5c5iWb78vwkFDgD+LxygKFw0Ji4wTeythASKy5q4FPBFjkRWkpjU3f3zt1O8OAaDnDpr85mlchjHNYdcyFq4WjM3wpqEd5/26JXQT85P2H1/QFQSwECHgMUAAAACAA6gfVUcY4yLn0AAACQAAAACAAYAAAAAAABAAAApIEAAAAAaW5kZXguanNVVAUAAzBe2WJ1eAsAAQT1AQAABBQAAABQSwUGAAAAAAEAAQBOAAAAvwAAAAAA';
// Base64 for zip file with the following code:
// exports.handler =  async function(event, context) {
//   console.log("EVENT: \n" + JSON.stringify(event, null, 3))
//   return context.logStreamName
// }
const lambdaFunctionCodeUpdate = 'UEsDBBQAAAAIAI2Y9lTkWkK7fQAAAJAAAAAIABwAaW5kZXguanNVVAkAA5rY2mKc2NpidXgLAAEE9QEAAAQUAAAANcyxDoIwEIDhnae4MNFIuriZOLI41AHj5NLUA5scV3K9Gojx3ZWB8R++H5c5iWb78vwkFDgD+LxygKFw0Ji4wTeythASKy5q4FPBFjkRWkpjU3f3zt1O8OAaDnDpr85mlchjHNYdcyFq4WjM3wpqEd5/26JXQT85P2H1/QFQSwECHgMUAAAACACNmPZU5FpCu30AAACQAAAACAAYAAAAAAABAAAApIEAAAAAaW5kZXguanNVVAUAA5rY2mJ1eAsAAQT1AQAABBQAAABQSwUGAAAAAAEAAQBOAAAAvwAAAAAA';
const lambdaFunctionHandler = 'index.handler';
const lambdaFunctionRuntime14 = 'nodejs14.x';
const lambdaFunctionRuntime16 = 'nodejs16.x';
const lambdaFunctionRoleName = `${prefix}${dbAlias}-role`;
const lambdaFunctionRoleTaskPolicyArn = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole';
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
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_lambda'];

jest.setTimeout(480000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Lambda Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the lambda module', install(modules));

  it('adds a new lambda function role', query(`
    INSERT INTO role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${lambdaFunctionRoleName}', '${attachAssumeLambdaPolicy}', array['${lambdaFunctionRoleTaskPolicyArn}']);
  `));

  it('applies the lambda function role change', apply());

  it('adds a new lambda function', query(`
    INSERT INTO lambda_function (name, zip_b64, handler, runtime, role_name)
    VALUES ('${lambdaFunctionName}', '${lambdaFunctionCode}', '${lambdaFunctionHandler}', '${lambdaFunctionRuntime14}', '${lambdaFunctionRoleName}');
  `));
  
  it('undo changes', sync());

  it('check function insertion', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new lambda function', query(`
      INSERT INTO lambda_function (name, zip_b64, handler, runtime, role_name)
      VALUES ('${lambdaFunctionName}', '${lambdaFunctionCode}', '${lambdaFunctionHandler}', '${lambdaFunctionRuntime14}', '${lambdaFunctionRoleName}');
  `));

  it('applies the lambda function change', apply());

  it('check function insertion', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  // Check restore path
  it('updates the function arn', query(`
    UPDATE lambda_function SET arn = 'fake' WHERE name = '${lambdaFunctionName}';
  `));

  it('applies the lambda function update', apply());

  it('check lambda function is restored', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND arn = 'fake';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check lambda function does still exist', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  // Check configuration update path
  it('updates the function', query(`
    UPDATE lambda_function SET runtime = '${lambdaFunctionRuntime16}' WHERE name = '${lambdaFunctionName}';
  `));

  it('applies the lambda function update', apply());

  it('check lambda function is updated', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND runtime = '${lambdaFunctionRuntime14}' ;
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check lambda function does still exist', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  // Check code update path
  it('updates the function', query(`
    UPDATE lambda_function SET zip_b64 = '${lambdaFunctionCodeUpdate}' WHERE name = '${lambdaFunctionName}';
  `));

  it('applies the lambda function update', apply());

  it('check lambda function is updated', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND zip_b64 is NULL;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check lambda function does still exist', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  // Check tags update path
  it('updates the function', query(`
    UPDATE lambda_function SET tags = '{"updated": "true"}' WHERE name = '${lambdaFunctionName}';
  `));

  it('applies the lambda function update', apply());

  it('check lambda function is updated', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND tags ->> 'updated' = 'true';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check lambda function does still exist', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('uninstalls the lambda module', uninstall(modules));

  it('installs the lambda module', install(modules));

  it('deletes the lambda function', query(`
    DELETE FROM lambda_function WHERE name = '${lambdaFunctionName}';
  `));

  it('check lambda function does not exist', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the lambda function removal', apply());

  it('check lambda function does not exist', query(`
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the lambda function role', query(`
    DELETE FROM role WHERE role_name = '${lambdaFunctionRoleName}';
  `));

  it('check lambda function role does not exists', query(`
    SELECT *
    FROM role 
    WHERE role_name = '${lambdaFunctionRoleName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the lambda function role removal', apply());

  it('check lambda function role does not exist', query(`
    SELECT *
    FROM role 
    WHERE role_name = '${lambdaFunctionRoleName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('Lambda install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the Lambda module and confirms one table is created', query(`
    select * from iasql_install('aws_lambda');
  `, (res: any[]) => {
      expect(res.length).toBe(1);
  }));

  it('uninstalls the Lambda module and confirms one table is removed', query(`
    select * from iasql_uninstall('aws_lambda');
  `, (res: any[]) => {
    expect(res.length).toBe(1);
  }));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the lambda module', uninstall(modules));

  it('installs the lambda module', install(modules));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
