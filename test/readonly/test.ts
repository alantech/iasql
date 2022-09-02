import * as iasql from '../../src/services/iasql'
import {
  execComposeDown,
  execComposeUp,
  finish,
  runInstall,
  runInstallAll,
  runUninstallAll,
  runQuery,
  runSync,
} from '../helpers'

const dbAlias = 'readonlytest';
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstallAll = runUninstallAll.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Aws read only Integration Testing', () => {

  it('creates a new test db with the same name', (done) => void iasql.connect(
    dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `));

  it('installs all modules', installAll());

  it('sync no-op', sync());

  it('adds a new repository', query(`
    INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
    VALUES ('test', false, 'MUTABLE');
  `));

  it('undo changes', sync());

  it('check adds a new repository', query(`
    SELECT *
    FROM repository
    WHERE repository_name = 'test';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new repository', query(`
    INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
    VALUES ('test', false, 'MUTABLE');
  `));

  it('fails to apply', (done) => {
    query(`
      select * from iasql_apply();
    `)((_e?: any) => done());  // Ignore failure
  });

  it('check apply error', query(`
    SELECT *
    FROM iasql_operation
    ORDER BY end_date DESC
    LIMIT 1;
  `, (row: any[]) => {
    expect(row.length).toBe(1);
    expect(row[0].optype).toBe('APPLY');
    expect(JSON.parse(row[0].err)).toHaveProperty('message')
  }));

  it('uninstalls all modules', uninstallAll());

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
