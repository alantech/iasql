import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runApply,
  runInstall,
  runQuery,
  runSync,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'loggrouplambdatest';
const resourceName = `${prefix}${dbAlias}`;
const lambdaLogGroupName = `/aws/lambda/${resourceName}`;
// Base64 for zip file with the following code:
// exports.handler =  async function(event, context) {
//   console.log("EVENT: \n" + JSON.stringify(event, null, 2))
//   return context.logStreamName
// }
const lambdaFunctionCode =
  'UEsDBBQAAAAIADqB9VRxjjIufQAAAJAAAAAIABwAaW5kZXguanNVVAkAAzBe2WIwXtlidXgLAAEE9QEAAAQUAAAANcyxDoIwEIDhnae4MNFIOjiaOLI41AHj5NLUA5scV3K9Gojx3ZWB8R++H5c5iWb78vwkFDgD+LxygKFw0Ji4wTeythASKy5q4FPBFjkRWkpjU3f3zt1O8OAaDnDpr85mlchjHNYdcyFq4WjM3wpqEd5/26JXQT85P2H1/QFQSwECHgMUAAAACAA6gfVUcY4yLn0AAACQAAAACAAYAAAAAAABAAAApIEAAAAAaW5kZXguanNVVAUAAzBe2WJ1eAsAAQT1AQAABBQAAABQSwUGAAAAAAEAAQBOAAAAvwAAAAAA';
const lambdaFunctionHandler = 'index.handler';
const lambdaFunctionRuntime14 = 'nodejs14.x';
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

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const region = defaultRegion();

const modules = ['aws_cloudwatch', 'aws_lambda'];
jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('AwsCloudwatch and AwsLambda Integration Testing', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `),
  );

  it('installs modules', install(modules));

  it(
    'adds a new lambda function and role',
    query(`
    BEGIN;
      INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
      VALUES ('${resourceName}', '${attachAssumeLambdaPolicy}', array['${lambdaFunctionRoleTaskPolicyArn}']);

      INSERT INTO lambda_function (name, zip_b64, handler, runtime, role_name)
      VALUES ('${resourceName}', '${lambdaFunctionCode}', '${lambdaFunctionHandler}', '${lambdaFunctionRuntime14}', '${resourceName}');
    COMMIT;
  `),
  );

  it('applies the lambda function change', apply());

  it(
    'check function insertion',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${resourceName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'invoke function',
    query(`SELECT * FROM invoke_lambda('${resourceName}');`, (res: any[]) => expect(res.length).toBe(1)),
  );

  it(
    'tail logs function',
    query(`SELECT * FROM log_group_tail('${lambdaLogGroupName}');`, (res: any[]) =>
      expect(res.length).toBeGreaterThan(0),
    ),
  );

  it(
    'delete resources',
    query(`
    BEGIN;
      DELETE FROM lambda_function WHERE name = '${resourceName}';
      DELETE FROM iam_role WHERE role_name = '${resourceName}';
      DELETE FROM log_group WHERE log_group_name = '${lambdaLogGroupName}';
    COMMIT;
  `),
  );

  it('apply deletion', apply());

  it(
    'check function deletion',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${resourceName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check role deletion',
    query(
      `
    SELECT *
    FROM iam_role 
    WHERE role_name = '${resourceName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check log group deletion',
    query(
      `
    SELECT *
    FROM log_group
    WHERE log_group_name = '${lambdaLogGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
