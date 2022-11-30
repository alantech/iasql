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
const dbAlias = 'cwtest';
const logGroupName = `${prefix}lgtest`;

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();

const modules = ['aws_cloudwatch'];
jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('AwsCloudwatch Integration Testing', () => {
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

  it('installs the cloudwatch module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new log group',
    query(
      `
    INSERT INTO log_group (log_group_name)
    VALUES ('${logGroupName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('sync before apply', rollback());

  it(
    'check no new log group',
    query(
      `
    SELECT *
    FROM log_group
    WHERE log_group_name = '${logGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a new log group',
    query(
      `
      INSERT INTO log_group (log_group_name)
      VALUES ('${logGroupName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check adds a new log group',
    query(
      `
    SELECT *
    FROM log_group
    WHERE log_group_name = '${logGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the log group change', commit());

  it('uninstalls the cloudwatch module', uninstall(modules));

  it('installs the cloudwatch module', install(modules));

  it('starts a transaction', begin());

  it(
    'tries to update a log group autogenerated field',
    query(
      `
      UPDATE log_group SET log_group_arn = '${logGroupName}2' WHERE log_group_name = '${logGroupName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the log group change which will undo the change', commit());

  it('starts a transaction', begin());

  it(
    'deletes the log group',
    query(
      `
      DELETE FROM log_group
      WHERE log_group_name = '${logGroupName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the log group change (last time)', commit());

  it(
    'check deletes the log group',
    query(
      `
    SELECT *
    FROM log_group
    WHERE log_group_name = '${logGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'creates a log group in default region',
    query(
      `
        INSERT INTO log_group (log_group_name)
        VALUES ('${logGroupName}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'also creates a log group in non-default region with the same name',
    query(
      `
        INSERT INTO log_group (log_group_name, region)
        VALUES (
            '${logGroupName}', (SELECT region FROM aws_regions WHERE is_default = false and is_enabled = true LIMIT 1)
        );
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies creation of two log groups with the same name, but different regions', commit());

  it(
    'ARNs and regions for the two log groups with the same name should be different',
    query(
      `
    SELECT *
    FROM log_group;
  `,
      (res: any) => {
        // two log groups
        expect(res.length).toBe(2);
        // have non-empty ARNs (came from the cloud)
        expect(res[0].log_group_arn !== '');
        expect(res[1].log_group_arn !== '');
        // their ARNs are not equal
        expect(res[0].log_group_arn !== res[1].log_group_arn).toBe(true);
        // but they have the same name (AWS does not allow duplicate name for log groups in a region)
        expect(res[0].log_group_name === res[1].log_group_name).toBe(true);
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the log group from the non-default region',
    query(
      `
        DELETE FROM log_group
        WHERE log_group_name = '${logGroupName}' AND region != default_aws_region();
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('syncs the state with the cloud to make sure it gets the resource from non-default region', rollback());

  it(
    'checks if the log group from the non-default region is back',
    query(
      `
        SELECT * FROM log_group
        WHERE log_group_name = '${logGroupName}' AND region != default_aws_region();
      `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the log group from the non-default region, this time for real',
    query(
      `
        DELETE FROM log_group
        WHERE log_group_name = '${logGroupName}' AND region != default_aws_region();
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the deletion of the log group from the non-default region', commit());

  it('syncs the state with the cloud', commit());

  it(
    'checks if the log group in the default region is still there',
    query(
      `
    SELECT * FROM log_group
    WHERE log_group_name = '${logGroupName}' AND region = default_aws_region();
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks if the log group in the non-default region is gone',
    query(
      `
    SELECT * FROM log_group
    WHERE log_group_name = '${logGroupName}' AND region != default_aws_region();
  `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the log group in the default region',
    query(
      `
        DELETE FROM log_group
        WHERE log_group_name = '${logGroupName}' AND region = default_aws_region();
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies deletion of the log group in the default region', commit());

  it(
    'checks the deletion of all of the log groups',
    query(
      `
    SELECT *
    FROM log_group
    WHERE log_group_name = '${logGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'creates a log group to be moved to another region',
    query(
      `
        INSERT INTO log_group (log_group_name, region)
        VALUES ('${logGroupName}', 'us-east-1');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies creation of the log group to be moved', commit());

  it('starts a transaction', begin());

  it(
    'moves the log group to a new region',
    query(
      `
        UPDATE log_group
        SET region = 'us-east-2'
        WHERE log_group_name = '${logGroupName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies moving the log group to the new region', commit());

  it('syncs the log groups from the cloud', commit());

  it(
    'checks if the log group has been moved to the new region',
    query(
      `
    SELECT * FROM log_group
    WHERE log_group_name = '${logGroupName}';
  `,
      (res: any) => {
        expect(res[0].region).toBe('us-east-2');
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes all the log groups for the last time',
    query(
      `
        DELETE FROM log_group;
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies deletion of all records', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('AwsCloudwatch install/uninstall', () => {
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

  it('installs the cloudwatch module', install(modules));

  it('uninstalls the cloudwatch module', uninstall(modules));

  it('installs all modules', installAll());

  it(
    'uninstalls the cloudwatch + codebuild + ecs module',
    uninstall([
      'aws_cloudwatch',
      'aws_codebuild',
      'aws_ecs_fargate',
      'aws_ecs_simplified',
      'aws_codepipeline',
    ]),
  );

  it('installs the cloudwatch module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
