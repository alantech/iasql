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
  runQuery,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'lambdaroletest';
const lambdaFunctionName = `${prefix}${dbAlias}`;
// Base64 for zip file with the following code:
// exports.handler =  async function(event, context) {
//   console.log("EVENT: \n" + JSON.stringify(event, null, 2))
//   return context.logStreamName
// }
const lambdaFunctionCode =
  'UEsDBBQAAAAIADqB9VRxjjIufQAAAJAAAAAIABwAaW5kZXguanNVVAkAAzBe2WIwXtlidXgLAAEE9QEAAAQUAAAANcyxDoIwEIDhnae4MNFIOjiaOLI41AHj5NLUA5scV3K9Gojx3ZWB8R++H5c5iWb78vwkFDgD+LxygKFw0Ji4wTeythASKy5q4FPBFjkRWkpjU3f3zt1O8OAaDnDpr85mlchjHNYdcyFq4WjM3wpqEd5/26JXQT85P2H1/QFQSwECHgMUAAAACAA6gfVUcY4yLn0AAACQAAAACAAYAAAAAAABAAAApIEAAAAAaW5kZXguanNVVAUAAzBe2WJ1eAsAAQT1AQAABBQAAABQSwUGAAAAAAEAAQBOAAAAvwAAAAAA';

const lambdaFunctionHandler = 'index.handler';
const lambdaFunctionRuntime14 = 'nodejs14.x';
const lambdaFunctionRoleName = `${prefix}${dbAlias}-role`;
const lambdaFunctionRoleTaskPolicyArn = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole';
const lambdaVpcFunctionRoleTaskPolicyArn =
  'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole';

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

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
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

  it('installs the lambda module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new lambda role',
    query(
      `
        INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
        VALUES ('${lambdaFunctionRoleName}', '${attachAssumeLambdaPolicy}', array['${lambdaFunctionRoleTaskPolicyArn}', '${lambdaVpcFunctionRoleTaskPolicyArn}']);
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check lambda function role does not exist',
    query(
      `
    SELECT *
    FROM iam_role 
    WHERE role_name = '${lambdaFunctionRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the iam role creation', commit());

  it(
    'check lambda function role does not exist',
    query(
      `
    SELECT *
    FROM iam_role 
    WHERE role_name = '${lambdaFunctionRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('give it some time for the role to propagate', async () => {
    await new Promise(r => setTimeout(r, 5000));
  });

  it('starts a transaction', begin());

  it(
    'adds a new lambda function',
    query(
      `
        INSERT INTO lambda_function (name, zip_b64, handler, runtime, subnets, role_name)
        VALUES ('${lambdaFunctionName}', '${lambdaFunctionCode}', '${lambdaFunctionHandler}', '${lambdaFunctionRuntime14}', (select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true and vpc.region = '${region}' limit 3)), '${lambdaFunctionRoleName}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('creates new lambda', commit());

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

  it('starts a transaction', begin());

  it(
    'deletes the lambda function role before the lambda',
    query(
      `
        DELETE FROM iam_role WHERE role_name = '${lambdaFunctionRoleName}';
      `,
      undefined,
      true,
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

  it('starts a transaction', begin());

  it(
    'deletes the lambda function',
    query(
      `
        DELETE FROM lambda_function WHERE name = '${lambdaFunctionName}';
      `,
      undefined,
      true,
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

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
