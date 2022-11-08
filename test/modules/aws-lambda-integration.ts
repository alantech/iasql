import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runCommit,
  runInstall,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'lambdatest';
const lambdaFunctionName = `${prefix}${dbAlias}`;
// Base64 for zip file with the following code:
// exports.handler =  async function(event, context) {
//   console.log("EVENT: \n" + JSON.stringify(event, null, 2))
//   return context.logStreamName
// }
const lambdaFunctionCode =
  'UEsDBBQAAAAIADqB9VRxjjIufQAAAJAAAAAIABwAaW5kZXguanNVVAkAAzBe2WIwXtlidXgLAAEE9QEAAAQUAAAANcyxDoIwEIDhnae4MNFIOjiaOLI41AHj5NLUA5scV3K9Gojx3ZWB8R++H5c5iWb78vwkFDgD+LxygKFw0Ji4wTeythASKy5q4FPBFjkRWkpjU3f3zt1O8OAaDnDpr85mlchjHNYdcyFq4WjM3wpqEd5/26JXQT85P2H1/QFQSwECHgMUAAAACAA6gfVUcY4yLn0AAACQAAAACAAYAAAAAAABAAAApIEAAAAAaW5kZXguanNVVAUAAzBe2WJ1eAsAAQT1AQAABBQAAABQSwUGAAAAAAEAAQBOAAAAvwAAAAAA';
// Base64 for zip file with the following code:
// exports.handler =  async function(event, context) {
//   console.log("EVENT: \n" + JSON.stringify(event, null, 3))
//   return context.logStreamName
// }
const lambdaFunctionCodeUpdate =
  'UEsDBBQAAAAIAI2Y9lTkWkK7fQAAAJAAAAAIABwAaW5kZXguanNVVAkAA5rY2mKc2NpidXgLAAEE9QEAAAQUAAAANcyxDoIwEIDhnae4MNFIuriZOLI41AHj5NLUA5scV3K9Gojx3ZWB8R++H5c5iWb78vwkFDgD+LxygKFw0Ji4wTeythASKy5q4FPBFjkRWkpjU3f3zt1O8OAaDnDpr85mlchjHNYdcyFq4WjM3wpqEd5/26JXQT85P2H1/QFQSwECHgMUAAAACACNmPZU5FpCu30AAACQAAAACAAYAAAAAAABAAAApIEAAAAAaW5kZXguanNVVAUAA5rY2mJ1eAsAAQT1AQAABBQAAABQSwUGAAAAAAEAAQBOAAAAvwAAAAAA';
const lambdaFunctionHandler = 'index.handler';
const lambdaFunctionRuntime14 = 'nodejs14.x';
const lambdaFunctionRuntime16 = 'nodejs16.x';
const lambdaFunctionRoleName = `${prefix}${dbAlias}-role`;
const lambdaFunctionRoleTaskPolicyArn = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole';
const attachAssumeLambdaPolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: {
        Service: 'lambda.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
});

const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_lambda'];

jest.setTimeout(480000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Lambda Integration Testing', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('installs the lambda module', install(modules));

  it(
    'adds a new lambda function and role',
    query(`
    BEGIN;
      INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
      VALUES ('${lambdaFunctionRoleName}', '${attachAssumeLambdaPolicy}', array['${lambdaFunctionRoleTaskPolicyArn}']);

      INSERT INTO lambda_function (name, zip_b64, handler, runtime, role_name)
      VALUES ('${lambdaFunctionName}', '${lambdaFunctionCode}', '${lambdaFunctionHandler}', '${lambdaFunctionRuntime14}', '${lambdaFunctionRoleName}');
    COMMIT;
  `),
  );

  it('undo changes', rollback());

  it(
    'check function insertion',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'adds a new lambda function and role',
    query(`
    BEGIN;
      INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
      VALUES ('${lambdaFunctionRoleName}', '${attachAssumeLambdaPolicy}', array['${lambdaFunctionRoleTaskPolicyArn}']);

      INSERT INTO lambda_function (name, zip_b64, handler, runtime, role_name)
      VALUES ('${lambdaFunctionName}', '${lambdaFunctionCode}', '${lambdaFunctionHandler}', '${lambdaFunctionRuntime14}', '${lambdaFunctionRoleName}');
    COMMIT;
  `),
  );

  it('applies the lambda function change', commit());

  it(
    'check function insertion',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Invoke Lambda function
  it(
    'invoke lambda',
    query(
      `
      SELECT *
      FROM invoke_lambda('${lambdaFunctionName}', '{"name": "test"}');
    `,
      (res: any[]) => {
        console.log(res[0]);
        expect(res[0]['status']).toBe('200');
        return expect(res.length).toBe(1);
      },
    ),
  );

  it('should fail when invoking without function name', done =>
    void query(`
    SELECT *
    FROM invoke_lambda();
  `)((e?: any) => {
      try {
        expect(e?.message).toContain('Please provide a valid lambda function name');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it('should fail invoking with wrong payload', done =>
    void query(`
      SELECT *
      FROM invoke_lambda('${lambdaFunctionName}', '{name: test}');
  `)((e?: any) => {
      try {
        expect(e?.message).toContain('The payload must be a valid JSON string');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  // Check restore path
  it(
    'updates the function arn',
    query(
      `
    UPDATE lambda_function SET arn = 'fake' WHERE name = '${lambdaFunctionName}';
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda function update', commit());

  it(
    'check lambda function is restored',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND arn = 'fake';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check lambda function does still exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Check configuration update path
  it(
    'updates the function',
    query(
      `
    UPDATE lambda_function SET runtime = '${lambdaFunctionRuntime16}' WHERE name = '${lambdaFunctionName}';
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda function update', commit());

  it(
    'check lambda function is updated',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND runtime = '${lambdaFunctionRuntime14}' ;
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check lambda function does still exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Check code update path
  it(
    'updates the function',
    query(
      `
    UPDATE lambda_function SET zip_b64 = '${lambdaFunctionCodeUpdate}' WHERE name = '${lambdaFunctionName}';
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda function update', commit());

  it(
    'check lambda function is updated',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND zip_b64 is NULL;
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check lambda function does still exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Check tags update path
  it(
    'updates the function',
    query(`
    UPDATE lambda_function SET tags = '{"updated": "true"}' WHERE name = '${lambdaFunctionName}';
  `),
  );

  it('applies the lambda function update', commit());

  it(
    'check lambda function is updated',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND tags ->> 'updated' = 'true';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check lambda function does still exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the lambda module', uninstall(modules));

  it('installs the lambda module', install(modules));

  it(
    'deletes the lambda function',
    query(
      `
    DELETE FROM lambda_function WHERE name = '${lambdaFunctionName}';
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it(
    'check lambda function does not exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the lambda function removal', commit());

  it(
    'check lambda function does not exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'deletes the lambda function role',
    query(
      `
    DELETE FROM iam_role WHERE role_name = '${lambdaFunctionRoleName}';
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it(
    'check lambda function role does not exists',
    query(
      `
    SELECT *
    FROM iam_role 
    WHERE role_name = '${lambdaFunctionRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the lambda function role removal', commit());

  it(
    'check lambda function role does not exist',
    query(
      `
    SELECT *
    FROM iam_role 
    WHERE role_name = '${lambdaFunctionRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('Lambda install/uninstall', () => {
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
    query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `),
  );

  it(
    'installs the Lambda module and confirms one table is created',
    query(
      `
    select * from iasql_install('aws_lambda');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
      },
    ),
  );

  it(
    'uninstalls the Lambda module and confirms one table is removed',
    query(
      `
    select * from iasql_uninstall('aws_lambda');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
      },
    ),
  );

  it('installs all modules', done =>
    void iasql.install([], dbAlias, config.db.user, true).then(...finish(done)));

  it('uninstalls the lambda module', uninstall(modules));

  it('installs the lambda module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
