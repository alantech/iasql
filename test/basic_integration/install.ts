import * as iasql from '../../src/services/iasql';
import {
  runQuery,
  finish,
  execComposeUp,
  execComposeDown,
  runInstall,
  runUninstallAll,
  runUninstall,
} from '../helpers';

const dbAlias = 'installtest';

const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const uninstallAll = runUninstallAll.bind(null, dbAlias);
const uid = '12345';
const email = 'test@example.com';

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Install cases', () => {
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

  it('installs a single module', install(['aws_lambda']));

  it('installs another module that share dependencies with the previous one', install(['aws_ec2']));

  it('uninstalls all', uninstallAll());

  it('installs having a duplication in the list', install(['aws_ecr', 'aws_ecr']));

  it('uninstalls having a duplication in the list', uninstall(['aws_ecr', 'aws_ecr']));

  it('installs having a module and its dependency in the same list', install(['aws_ec2', 'aws_vpc']));

  it('reinstalls existing modules', install(['aws_ec2', 'aws_vpc']));

  it('uninstalls all', uninstallAll());

  it('installs complex and dependent sql module', install(['aws_ecs_fargate', 'aws_ecs_simplified']));

  it('fails having an install with a typo', done =>
    void query(`
    SELECT * FROM iasql_install('aws_ec3')
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
