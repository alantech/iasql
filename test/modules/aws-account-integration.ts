import * as iasql from '../../src/services/iasql'
import {
  execComposeDown,
  execComposeUp,
  finish,
  runApply,
  runQuery,
  getRandomRegion,
} from '../helpers'

jest.setTimeout(360000);

beforeAll(execComposeUp);

afterAll(execComposeDown);

const dbAlias = 'accounttest';
const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);

describe('AwsAccount Integration Testing', () => {
  // TODO: Restore some mechanism to verify credentials
  /*it('does not create a test DB with fake credentials', (done) => void iasql.add(
    dbAlias,
    getRandomRegion(),
    'fake',
    'credentials',
    'not-needed').then(
      () => done(new Error('Should not have succeeded')),
      () => done(),
    ));*/

  it('creates a new test db with the same name', (done) => void iasql.add(
    dbAlias,
    getRandomRegion(),
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('inserts a second, useless row into the aws_account table', query(`
    INSERT INTO aws_account (access_key_id, secret_access_key, region)
    VALUES ('fake', 'creds', 'us-west-2')
  `));

  it('does absolutely nothing when you apply this', apply);

  it('removes the useless row', query(`
    DELETE FROM aws_account WHERE access_key_id = 'fake'
  `));
});
