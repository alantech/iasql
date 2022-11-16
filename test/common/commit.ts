import * as iasql from '../../src/services/iasql';
import { runQuery, finish, execComposeUp, execComposeDown, runInstall } from '../helpers';

const dbAlias = 'allmodulestest';

const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uid = '12345';
const email = 'test@example.com';
const logGroupName = 'teslgcommit';

let username: string, password: string;

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('basic commit and preview functionality', () => {
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

  it(
    'calls iasql_preview should expect a creation',
    query(
      `
    select * from iasql_preview();
  `,
      (res: any) => {
        expect(res[0]['action']).toBe('create');
      },
    ),
  );

  it(
    'calls iasql_commit should create',
    query(
      `
    select * from iasql_commit();
  `,
      (res: any) => {
        expect(res[0]['action']).toBe('create');
      },
    ),
  );

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
