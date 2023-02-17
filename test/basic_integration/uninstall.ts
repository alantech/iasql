import * as iasql from '../../src/services/iasql';
import { runQuery, finish, execComposeUp, execComposeDown, runInstall } from '../helpers';

const dbAlias = 'uninstalltest';

const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uid = '12345';
const email = 'test@example.com';

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('uninstall SQL injection prevention', () => {
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

  it('installs the aws_security_group module', install(['aws_security_group']));

  it('fails on an attempted SQL injection attack', done =>
    void query(`
    SELECT * FROM iasql_uninstall('aws_security_group'', (DROP TABLE aws_account)]) as module) as mo on true --')
  `)((e?: any) => {
      try {
        expect(e?.message).toContain('The following modules do not exist');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, uid).then(...finish(done)));
});
