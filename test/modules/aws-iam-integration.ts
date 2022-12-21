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
  runInstallAll,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'iamtest';
const region = defaultRegion();
const awsServiceRoleName = 'AWSServiceRoleForSupport';
const taskRoleName = `${prefix}${dbAlias}task-${region}`;
const taskPolicyArn = 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy';
const servicePolicyArn = 'arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role';
const userConfigPolicyArn = 'arn:aws:iam::aws:policy/AWSConfigUserAccess';
const supportUserPolicyArn = 'arn:aws:iam::aws:policy/job-function/SupportUser';
const lambdaRoleName = `${prefix}${dbAlias}lambda-${region}`;
const ec2RoleName = `${prefix}${dbAlias}ec2-${region}`;
const ec2RoleNameArray = `${prefix}${dbAlias}ec2Array-${region}`;
const anotherRoleName = `${prefix}${dbAlias}another-${region}`;
const principalServArr = `${prefix}${dbAlias}ppalservarr-${region}`;
const attachAssumeTaskPolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Sid: '',
      Effect: 'Allow',
      Principal: {
        Service: 'ecs-tasks.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
});
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
const attachAssumeEc2Policy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: {
        Service: 'ec2.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
});
const attachAssumeEc2PolicyArray = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: {
        Service: ['ec2.amazonaws.com'],
      },
      Action: 'sts:AssumeRole',
    },
  ],
});
const attachAnotherPolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Action: ['sts:AssumeRoleWithSAML', 'sts:TagSession'],
      Effect: 'Allow',
      Condition: {
        StringEquals: {
          'SAML:aud': 'https://signin.aws.amazon.com/saml',
        },
      },
      Principal: {
        Federated: 'arn:aws:iam::123456789123:saml-provider/AWSSSO_01c318b42a2dcb07_DO_NOT_DELETE',
      },
    },
  ],
});
const attachPrincipalServArrPolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Action: 'sts:AssumeRole',
      Effect: 'Allow',
      Principal: {
        Service: ['airflow.amazonaws.com', 'airflow-env.amazonaws.com'],
      },
    },
  ],
});

const userName = `${prefix}${dbAlias}username`;
const userPath = `/username/`;
const userNewPath = `/username1/`;

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_iam'];

jest.setTimeout(480000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

/*describe('IAM Role Integration Testing', () => {
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

  it('installs the iam module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new iam_role',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document)
    VALUES ('${lambdaRoleName}', '${attachAssumeLambdaPolicy}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'check undo a new role addition',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${lambdaRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a new role',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${taskRoleName}', '${attachAssumeTaskPolicy}', array['${taskPolicyArn}']);
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
    BEGIN;
      INSERT INTO iam_role (role_name, assume_role_policy_document)
      VALUES ('${lambdaRoleName}', '${attachAssumeLambdaPolicy}');

      INSERT INTO iam_role (role_name, assume_role_policy_document)
      VALUES ('${ec2RoleName}', '${attachAssumeEc2Policy}');

      INSERT INTO iam_role (role_name, assume_role_policy_document)
      VALUES ('${ec2RoleNameArray}', '${attachAssumeEc2PolicyArray}');

      INSERT INTO iam_role (role_name, assume_role_policy_document)
      VALUES ('${anotherRoleName}', '${attachAnotherPolicy}');

      INSERT INTO iam_role (role_name, assume_role_policy_document)
      VALUES ('${principalServArr}', '${attachPrincipalServArrPolicy}');
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check a new role addition',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${taskRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check a new role addition',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${lambdaRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check a new role addition',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${ec2RoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check a new role addition',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${ec2RoleNameArray}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check a new role addition',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${anotherRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check a new role addition',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${principalServArr}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the role additions', commit());

  it('starts a transaction', begin());

  it(
    'tries to update a autogenerated field',
    query(
      `
    UPDATE iam_role SET arn = 'dummy' WHERE role_name = '${taskRoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  // The next 3 checks are to validate that the deep policy comparison is working properly
  it(
    'check preview',
    query(
      `
    SELECT *
    FROM iasql_preview();
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check preview',
    query(
      `
    SELECT *
    FROM iasql_preview();
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check preview',
    query(
      `
    SELECT *
    FROM iasql_preview();
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies change which will undo it', rollback());

  it(
    'check update role (noop)',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${taskRoleName}' AND arn = 'dummy';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update a role description',
    query(
      `
    UPDATE iam_role SET description = 'description' WHERE role_name = '${taskRoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies change', commit());

  it('starts a transaction', begin());

  it(
    'tries to update ec2 policy field',
    query(
      `
    UPDATE iam_role SET assume_role_policy_document = '${attachAssumeLambdaPolicy}' WHERE role_name = '${ec2RoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies change', commit());

  it('starts a transaction', begin());

  it(
    'tries to restore ec2 policy field',
    query(
      `
    UPDATE iam_role SET assume_role_policy_document = '${attachAssumeEc2Policy}' WHERE role_name = '${ec2RoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies change', commit());

  it(
    'check update role description',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${taskRoleName}' AND description = 'description';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update role attached policies',
    query(
      `
    UPDATE iam_role SET attached_policies_arns=array['${servicePolicyArn}'] WHERE role_name = '${taskRoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies change', commit());

  it(
    'check update role policy',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${taskRoleName}' AND description = 'description';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1),
          expect(res[0].attached_policies_arns).toStrictEqual([`${servicePolicyArn}`]);
      },
    ),
  );

  it('uninstalls the iam module', uninstall(modules));

  it('installs the iam module', install(modules));

  it('starts a transaction', begin());

  it(
    'deletes the role',
    query(
      `
    DELETE FROM iam_role
    WHERE role_name = '${taskRoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'deletes the role',
    query(
      `
    DELETE FROM iam_role
    WHERE role_name = '${lambdaRoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'deletes the role',
    query(
      `
    DELETE FROM iam_role
    WHERE role_name = '${ec2RoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'deletes the role',
    query(
      `
    DELETE FROM iam_role
    WHERE role_name = '${ec2RoleNameArray}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'deletes the role',
    query(
      `
    DELETE FROM iam_role
    WHERE role_name = '${anotherRoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'deletes the role',
    query(
      `
    DELETE FROM iam_role
    WHERE role_name = '${principalServArr}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'check deletes the role',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${taskRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check deletes the role',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${lambdaRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check deletes the role',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${ec2RoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check deletes the role',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${ec2RoleNameArray}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check deletes the role',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${anotherRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check deletes the role',
    query(
      `
    SELECT *
    FROM iam_role
    WHERE role_name = '${principalServArr}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'creates a lot of similar roles to try to hit the rate-limiter',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document)
    VALUES ${Array(100)
      .fill('')
      .map((_, i) => `('${lambdaRoleName}-${i}', '${attachAssumeLambdaPolicy}')`)
      .join(', ')};
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('creates these things', commit());

  it('uninstalls the iam module', uninstall(modules));

  it('installs the iam module', install(modules));

  it('starts a transaction', begin());

  it(
    'deletes all of this similar roles',
    query(
      `
    DELETE FROM iam_role
    WHERE role_name in (${Array(100)
      .fill('')
      .map((_, i) => `'${lambdaRoleName}-${i}'`)
      .join(', ')});
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('deletes these things', commit());

  describe('AWS service roles', () => {
    it(
      'check service role',
      query(
        `
      SELECT *
      FROM iam_role
      WHERE role_name = '${awsServiceRoleName}';
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );

    it('starts a transaction', begin());

    it(
      'tries to update aws service role field',
      query(
        `
      UPDATE iam_role SET arn = 'dummy' WHERE role_name = '${awsServiceRoleName}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies change which will undo it', rollback());

    it(
      'check update aws service role (noop)',
      query(
        `
      SELECT *
      FROM iam_role
      WHERE role_name = '${awsServiceRoleName}' AND arn = 'dummy';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );

    it('starts a transaction', begin());

    it(
      'tries to delete an aws service role',
      query(
        `
      DELETE FROM iam_role WHERE role_name = '${awsServiceRoleName}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it(
      'check delete aws service role before apply',
      query(
        `
      SELECT *
      FROM iam_role
      WHERE role_name = '${awsServiceRoleName}';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );

    it('applies change which will undo it', commit());

    it(
      'check delete aws service role (noop)',
      query(
        `
      SELECT *
      FROM iam_role
      WHERE role_name = '${awsServiceRoleName}';
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );
  });

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});*/

describe('IAM User Integration Testing', () => {
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

  it('installs the iam module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new user',
    query(
      `
    INSERT INTO iam_user (user_name, path, attached_policies_arns)
    VALUES ('${userName}', '${userPath}', array['${userConfigPolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'check undo a new user addition',
    query(
      `
    SELECT *
    FROM iam_user
    WHERE user_name = '${userName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a new user',
    query(
      `
    INSERT INTO iam_user (user_name, path)
    VALUES ('${userName}', '${userPath}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies change', commit());

  it(
    'check a new user addition',
    query(
      `
    SELECT *
    FROM iam_user
    WHERE user_name = '${userName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'updates user arn',
    query(
      `
    UPDATE iam_user SET arn = 'arn' WHERE user_name = '${userName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies change', commit());

  it(
    'check that arn has not been modified',
    query(
      `
    SELECT *
    FROM iam_user
    WHERE user_name = '${userName}' AND arn='arn';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'updates user path',
    query(
      `
    UPDATE iam_user SET path = '${userNewPath}' WHERE user_name = '${userName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies change', commit());

  it(
    'check that path has been modified',
    query(
      `
    SELECT *
    FROM iam_user
    WHERE user_name = '${userName}' AND path = '${userNewPath}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update user attached policies',
    query(
      `
    UPDATE iam_user SET attached_policies_arns=array['${supportUserPolicyArn}'] WHERE user_name = '${userName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies change', commit());

  it(
    'check update user policy',
    query(
      `
    SELECT *
    FROM iam_user
    WHERE user_name = '${userName}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1),
          expect(res[0].attached_policies_arns).toStrictEqual([`${supportUserPolicyArn}`]);
      },
    ),
  );

  // generate access keys
  it(
    'generates a new access key',
    query(
      `
    SELECT *
    FROM access_key_request('${userName}');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check new access key added',
    query(
      `
    SELECT *
    FROM access_key
    WHERE user_name = '${userName}' AND status='Active';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());
  it(
    'updates access key status',
    query(
      `
    UPDATE access_key SET status='Inactive'
    WHERE user_name = '${userName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the access key update', commit());

  it(
    'check access key updated',
    query(
      `
    SELECT *
    FROM access_key
    WHERE user_name = '${userName}' AND status='Active';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );
  it(
    'check access key updated',
    query(
      `
    SELECT *
    FROM access_key
    WHERE user_name = '${userName}' AND status='Inactive';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());
  it(
    'deletes the access key',
    query(
      `
    DELETE FROM access_key
    WHERE user_name = '${userName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the access key deletion', commit());

  it(
    'check new access key deleted',
    query(
      `
    SELECT *
    FROM access_key
    WHERE user_name = '${userName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to delete an aws user',
    query(
      `
    DELETE FROM iam_user WHERE user_name = '${userName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies change', commit());

  it(
    'check delete aws user',
    query(
      `
    SELECT *
    FROM iam_user
    WHERE user_name = '${userName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

/*describe('IAM install/uninstall', () => {
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

  it('installs the IAM module', install(modules));

  it('uninstalls the IAM module', uninstall(modules));

  it('installs all modules', installAll());

  it(
    'uninstalls the IAM module',
    uninstall([
      'aws_ec2',
      'aws_ec2_metadata',
      'aws_ecs_fargate',
      'aws_ecs_simplified',
      'aws_lambda',
      'aws_codebuild',
      'aws_codedeploy',
      'aws_codepipeline',
      'aws_iam',
    ]),
  );

  it('installs the IAM module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});*/
