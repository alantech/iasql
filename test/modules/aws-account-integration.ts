import * as scheduler from '../../src/services/scheduler'
import * as iasql from '../../src/services/iasql'
import {
  execComposeDown,
  execComposeUp,
  finish,
  runApply,
  runQuery,
  runSync,
} from '../helpers'

const dbAlias = 'accounttest';
const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('AwsAccount Integration Testing', () => {
  // TODO: Restore some mechanism to verify credentials
  /*it('does not create a test DB with fake credentials', (done) => void iasql.add(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    'fake',
    'credentials',
    'not-needed').then(
      () => done(new Error('Should not have succeeded')),
      () => done(),
    ));*/

  it('creates a new test db with the same name', (done) => void iasql.add(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

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

  it('does absolutely nothing when you plan this', query(`
    select iasql_plan_apply();
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('removes the useless row', query(`
    DELETE FROM aws_account WHERE access_key_id = 'fake'
  `));

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
