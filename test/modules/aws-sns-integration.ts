import AWS from 'aws-sdk';
import AWSMock from 'aws-sdk-mock';

import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  itDocs,
  runBegin,
  runCommit,
  runInstall,
  runInstallAll,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'snstest';

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();

const lambdaFunctionName = `${prefix}${dbAlias}`;
const lambdaFunctionCode =
  'UEsDBBQAAAAIADqB9VRxjjIufQAAAJAAAAAIABwAaW5kZXguanNVVAkAAzBe2WIwXtlidXgLAAEE9QEAAAQUAAAANcyxDoIwEIDhnae4MNFIOjiaOLI41AHj5NLUA5scV3K9Gojx3ZWB8R++H5c5iWb78vwkFDgD+LxygKFw0Ji4wTeythASKy5q4FPBFjkRWkpjU3f3zt1O8OAaDnDpr85mlchjHNYdcyFq4WjM3wpqEd5/26JXQT85P2H1/QFQSwECHgMUAAAACAA6gfVUcY4yLn0AAACQAAAACAAYAAAAAAABAAAApIEAAAAAaW5kZXguanNVVAUAAzBe2WJ1eAsAAQT1AQAABBQAAABQSwUGAAAAAAEAAQBOAAAAvwAAAAAA';
// Base64 for zip file with the following code:
// exports.handler =  async function(event, context) {
//   console.log("EVENT: \n" + JSON.stringify(event, null, 3))
//   return context.logStreamName
// }
const lambdaFunctionHandler = 'index.handler';
const lambdaFunctionRuntime14 = 'nodejs14.x';
const lambdaFunctionRoleName = `${prefix}${dbAlias}-role`;

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
const lambdaFunctionRoleTaskPolicyArn = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole';
const modules = ['aws_sns', 'aws_lambda'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;
const topicName = `${prefix}topic`;

describe('AwsSNS Integration Testing', () => {
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

  itDocs('installs the SNS module', install(modules));

  describe('testing confirmation', () => {
    beforeAll(() => {
      AWSMock.setSDKInstance(AWS);
      AWSMock.mock(
        'SNS',
        'confirmSubscription',
        (_params: { TopicArn: 'test'; Token: 'test' }, callback: Function) => {
          console.log('mock being called');
          callback(null, { SubscriptionArn: 'test' });
        },
      );
    });
    it(
      'confirms the subscription',
      query(
        `
          SELECT * FROM confirm_subscription('test', 'token');
      `,
        (res: any[]) => {
          expect(res.length).toBe(1);
          expect(res[0].status).toBe('OK');
        },
      ),
    );
    afterAll(() => {
      AWSMock.restore();
    });
  });

  // unsubscribe
  it(
    'unsubscribes',
    query(
      `
      SELECT * FROM unsubscribe((SELECT arn FROM subscription WHERE endpoint='${prefix}test@iasql.com'));
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].status).toBe('OK');
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a new SNS topic',
    query(
      `
    INSERT INTO topic (name)
    VALUES ('${topicName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('sync before apply', rollback());

  it(
    'check no new SNS',
    query(
      `
    SELECT *
    FROM topic
    WHERE name = '${topicName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'adds a new topic',
    query(
      `
      INSERT INTO topic (name)
      VALUES ('${topicName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'check adds a new topic',
    query(
      `
    SELECT *
    FROM topic
    WHERE name = '${topicName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the topic change', commit());

  it('uninstalls the SNS module', uninstall(modules));

  it('installs the SNS module', install(modules));

  it('starts a transaction', begin());

  it(
    'tries to update a topic autogenerated field',
    query(
      `
      UPDATE topic SET arn = '${topicName}2' WHERE name = '${topicName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the topic change which will undo the change', commit());

  it(
    'check ARN change has been reverted',
    query(
      `
    SELECT *
    FROM topic
    WHERE name = '${topicName}' AND arn='${topicName}2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update a field with an incorrect value',
    query(
      `
      UPDATE topic SET tracing_config = 'PassThrough1' WHERE name = '${topicName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('checks that value gets rejected', () => {
    try {
      commit();
    } catch (e) {
      expect(e).toBeTruthy();
    }
  });

  it('performs a rollback that will revert the change', rollback());

  it(
    'check tracing config change has been reverted',
    query(
      `
    SELECT *
    FROM topic
    WHERE name = '${topicName}' AND tracing_config='PassThrough1';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'tries to update a field with an correct value',
    query(
      `
      UPDATE topic SET tracing_config = 'PassThrough' WHERE name = '${topicName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the topic change which will be correct', commit());

  itDocs(
    'check tracing config change has been applied',
    query(
      `
    SELECT *
    FROM topic
    WHERE name = '${topicName}' AND tracing_config='PassThrough';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // testing for subscription
  it('starts a transaction', begin());

  it(
    'adds a new lambda function',
    query(
      `
        BEGIN;
          INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
          VALUES ('${lambdaFunctionRoleName}', '${attachAssumeLambdaPolicy}', array['${lambdaFunctionRoleTaskPolicyArn}']);
  
          INSERT INTO lambda_function (name, zip_b64, handler, runtime, role_name)
          VALUES ('${lambdaFunctionName}', '${lambdaFunctionCode}', '${lambdaFunctionHandler}', '${lambdaFunctionRuntime14}', '${lambdaFunctionRoleName}');
        COMMIT;
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda creation', commit());

  it(
    'subscribes to a topic',
    query(
      `
      SELECT * FROM subscribe((SELECT arn FROM topic WHERE name='${topicName}'), (SELECT arn FROM lambda_function WHERE name='${lambdaFunctionName}'), 'lambda');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].status).toBe('OK');
      },
    ),
  );

  it(
    'check subscription has been created',
    query(
      `
    SELECT *
    FROM subscription
    WHERE endpoint=(SELECT arn FROM lambda_function WHERE name='${lambdaFunctionName}');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // unsubscribe
  it(
    'unsubscribes',
    query(
      `
      SELECT * FROM unsubscribe((SELECT arn FROM subscription WHERE endpoint=(SELECT arn FROM lambda_function WHERE name='${lambdaFunctionName}')));
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].status).toBe('OK');
      },
    ),
  );

  it(
    'check subscription has been removed',
    query(
      `
    SELECT *
    FROM subscription
    WHERE endpoint=(SELECT arn FROM lambda_function WHERE name='${lambdaFunctionName}');
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'subscribes to a topic that needs manual confirmation',
    query(
      `
      SELECT * FROM subscribe((SELECT arn FROM topic WHERE name='${topicName}'), '${prefix}test@iasql.com', 'email');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check subscription has been created and is pending to confirm',
    query(
      `
    SELECT *
    FROM subscription
    WHERE endpoint='${prefix}test@iasql.com' AND arn='PendingConfirmation';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // mock SNS confirm subscription call

  // deleting components
  it('starts a transaction', begin());

  itDocs(
    'deletes the topic',
    query(
      `
      DELETE FROM topic
      WHERE name = '${topicName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the topic delete', commit());

  itDocs(
    'check deletes the topic',
    query(
      `
    SELECT *
    FROM topic
    WHERE name = '${topicName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'deletes the lambda function',
    query(
      `
      BEGIN;  
    DELETE FROM lambda_function WHERE name = '${lambdaFunctionName}';
    DELETE FROM iam_role WHERE role_name = '${lambdaFunctionRoleName}';

    COMMIT;

  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('AwsSNS install/uninstall', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the SNS module', install(modules));

  it('uninstalls the SNS module', uninstall(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
