import * as iasql from '../../src/services/iasql';
import { runQuery, finish, execComposeUp, execComposeDown, runInstall } from '../helpers';

const dbAlias = 'rollbacktest';

const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uid = '12345';
const email = 'test@example.com';
const logGroupName = 'teslgcommit';

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('basic rollback functionality', () => {
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
    SELECT * FROM iasql_begin();
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
    SELECT * FROM iasql_begin();
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
    'calls iasql_rollback should delete',
    query(
      `
    select * from iasql_rollback();
  `,
      (res: any) => {
        expect(res[0]['action']).toBe('delete');
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
        expect(res.length).toBe(0);
      },
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, uid).then(...finish(done)));
});
