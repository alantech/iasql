import * as iasql from '../../src/services/iasql';
import {
  execComposeDown,
  execComposeUp,
  finish,
  runInstall,
  runInstallAll,
  runUninstallAll,
  runQuery,
  runCommit,
  runRollback,
  runBegin,
} from '../helpers';

const dbAlias = 'readonlytest';
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstallAll = runUninstallAll.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const begin = runBegin.bind(null, dbAlias);

jest.setTimeout(420000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Aws read only Integration Testing', () => {
  it('creates a new test db with the same name', done => {
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

  it('installs all modules', installAll());

  it('starts a transaction', begin());

  it('sync no-op', commit());

  it('starts a transaction', begin());

  it(
    'adds a new repository',
    query(
      `
    INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
    VALUES ('test', false, 'MUTABLE');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'check adds a new repository',
    query(
      `
    SELECT *
    FROM repository
    WHERE repository_name = 'test';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a new repository',
    query(
      `
    INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
    VALUES ('test', false, 'MUTABLE');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('fails to apply and restore on sync phase', done => {
    query(`
      select * from iasql_commit();
    `)((_e?: any) => done()); // Ignore failure
  });

  it(
    'check apply error',
    query(
      `
    SELECT *
    FROM iasql_rpc
    ORDER BY end_date DESC
    LIMIT 1;
  `,
      (row: any[]) => {
        expect(row.length).toBe(1);
        expect(row[0].module_name).toBe('iasql_functions');
        expect(row[0].method_name).toBe('iasqlCommit');
      },
    ),
  );

  it('undo changes to close the transaction', rollback());

  it('uninstalls all modules', uninstallAll());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
