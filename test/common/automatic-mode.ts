import * as iasql from '../../src/services/iasql';
import { runQuery, finish, execComposeUp, execComposeDown, runInstall, runBegin } from '../helpers';

const dbAlias = 'automatictest';

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uid = '12345';
const email = 'test@example.com';
const logGroupName = 'test-automatic';

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Automatic mode', () => {
  it('creates a new test db', done => {
    (async () => {
      try {
        const { user, password: pgPassword } = await iasql.connect(dbAlias, uid, email);
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

  it('installs the aws_cloudwatch module', install(['aws_cloudwatch']));

  it(
    'insert a log group',
    query(
      `
        insert into log_group (log_group_name) values ('${logGroupName}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('wait for 2 min to let the cron be triggered', async () => {
    await new Promise(r => setTimeout(r, 2 * 60 * 1000));
  });

  it(
    'checks the log group',
    query(
      `
        select * from log_group where log_group_name = '${logGroupName}';
      `,
      (res: any) => {
        expect(res[0]['log_group_arn']).toBeDefined();
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the log group',
    query(
      `
        delete from log_group where log_group_name = '${logGroupName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'calls iasql_commit should delete',
    query(
      `
        select * from iasql_commit();
      `,
      (res: any) => {
        expect(res[0]['action']).toBe('delete');
      },
    ),
  );

  it(
    'checks the log group deletion',
    query(
      `
        select * from log_group where log_group_name = '${logGroupName}';
      `,
      (res: any) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, uid).then(...finish(done)));
});
