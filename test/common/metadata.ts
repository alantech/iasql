import * as iasql from '../../src/services/iasql'
import { runQuery, finish, execComposeUp, execComposeDown } from '../helpers'
import MetadataRepo from '../../src/services/repositories/metadata'

const query = runQuery.bind(null, 'iasql_metadata');
const dbAlias = 'metadatatest';
const uid = '12345'

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Testing metadata repo', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    uid, 'not-needed').then(...finish(done)));

  it('check row in iasql database table exists', query(`
    SELECT *
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `, (row: any[]) => expect(row.length).toBe(1)));

  it('check row in join table exists', query(`
    SELECT *
    FROM iasql_user_databases
    WHERE iasql_database_pg_name = '${dbAlias}';
  `, async (row: any[]) => {
    expect(row.length).toBe(1);
    const user = await MetadataRepo.getUserFromDbId(dbAlias);
    expect(user.id).toBe(uid);
  }));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, uid)
    .then(...finish(done)));

  it('check there is no row in iasql database', query(`
    SELECT *
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `, (row: any[]) => expect(row.length).toBe(0)));

  it('check there is no row in join table', query(`
    SELECT *
    FROM iasql_user_databases
    WHERE iasql_database_pg_name = '${dbAlias}';
  `, (row: any[]) => expect(row.length).toBe(0)));
});

