import * as iasql from '../../src/services/iasql';
import { runQuery, finish, execComposeUp, execComposeDown, runInstall, runBegin } from '../helpers';

const dbAlias = 'getsqlsince';

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('iasql_get_sql_since functionality', () => {
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

  it(
    'should work with no arguments retrieving all logs',
    query(
      `
        select * from iasql_get_sql_since();
      `,
      (res: any) => {
        expect(res.length).toBeGreaterThan(0);
      },
    ),
  );

  it(
    'should work with a valid text timestamp',
    query(
      `
        select * from iasql_get_sql_since('2023-01-01T12:00:00');
      `,
      (res: any) => {
        expect(res.length).toBeGreaterThan(0);
      },
    ),
  );

  it(
    'should work with a dynamic date',
    query(
      `
        select * from iasql_get_sql_since((now() + interval '2 seconds')::text);
      `,
      (res: any) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it('should fail with a string that cannot be casted to timestamp with timezone', done =>
    void query(`
      select * from iasql_get_sql_since('abcd');
    `)((e?: any) => {
      try {
        expect(e?.message).toBe('Cannot cast abcd to timestamp with time zone');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  // todo: test insert, update and delete with all different datatypes

  // it(
  //   'manual inserts on iasql audit logs',
  //   query(
  //     `
  //       insert into iasql_audit_log (ts, table_name, user, change_type, change)
  //       values (now(), 'iasql_audit_log', session_user, 'INSERT',  ('{"change": ${}}')::json)
  //     `,
  //     undefined,
  //     true,
  //     () => ({ username, password }),
  //   ),
  // );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
