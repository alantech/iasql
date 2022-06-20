import * as scheduler from '../../src/services/scheduler'
import * as iasql from '../../src/services/iasql'
import {
  execComposeDown,
  execComposeUp,
  finish,
  runApply,
  runInstall,
  runQuery,
  runSync,
} from '../helpers'
import config from '../../src/config'

const latestVersion = config.modules.latestVersion;
const oldestVersion = config.modules.oldestVersion;

const dbAlias = 'accounttest';
const apply = runApply.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('AwsAccount Integration Testing', () => {
  // TODO: Restore some mechanism to verify credentials
  /*it('does not create a test DB with fake credentials', (done) => void iasql.connect(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    'fake',
    'credentials',
    'not-needed').then(
      () => done(new Error('Should not have succeeded')),
      () => done(),
    ));*/

  it('creates a new test db with the same name', (done) => void iasql.connect(
    dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('inserts a second, useless row into the aws_account table', query(`
    INSERT INTO aws_account (access_key_id, secret_access_key, region)
    VALUES ('fake', 'creds', 'us-west-2')
  `));

  it('does absolutely nothing when you apply this', apply());

  // tests that on startup subsequent iasql ops for existing dbs succeed
  it('stops the worker for all dbs', (done) => void scheduler
    .stopAll()
    .then(...finish(done)));
  it('starts a worker for each db', (done) => void scheduler
    .init()
    .then(...finish(done)));

  it('does absolutely nothing when you sync this', sync());

  it('does absolutely nothing when you preview this', query(`
    select iasql_preview_apply();
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('removes the useless row', query(`
    DELETE FROM aws_account WHERE access_key_id = 'fake'
  `));

  it('returns records when calling iasql_help', query(`
    SELECT * FROM iasql_help();
  `, (res: any[]) => expect(res.length).toBeGreaterThan(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));

  it('creates a new test db using the oldest version via trickery', (done) => {
    // This works because we don't actually `Object.freeze` the config and `const` in JS is dumb
    config.modules.latestVersion = oldestVersion;
    iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done));
  });

  it('confirms the version is the oldest version', query(`
    SELECT name FROM iasql_module LIMIT 1;
  `, (res: any[]) => {
    expect(res.length).toBe(1);
    expect(res[0].name.split('@')[1]).toEqual(oldestVersion);
  }));

  it('deletes the test db and restores the version', (done) => {
    iasql.disconnect(dbAlias, 'not-needed').then(...finish(done));
    config.modules.latestVersion = latestVersion;
  });

  it('creates another test db', (done) => void iasql
    .connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done)));


  it('updates the iasql_* modules to pretend to be an ancient version', query(`
    UPDATE iasql_module SET name = 'iasql_platform@0.0.2' WHERE name = 'iasql_platform@${latestVersion}';
    UPDATE iasql_module SET name = 'iasql_functions@0.0.2' WHERE name = 'iasql_functions@${latestVersion}';
  `));


  it('deletes the busted test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
