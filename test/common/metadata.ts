import * as iasql from '../../src/services/iasql'
import { runQuery, finish, execComposeUp, execComposeDown } from '../helpers'

const query = runQuery.bind(null, 'iasql_metadata');
const dbAlias = 'metadatatest';

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Testing failure path', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('check row iasql database exists', query(`
    SELECT *
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `, (row: any[]) => expect(row.length).toBe(1)));

  it('check row in join table exists', query(`
    SELECT *
    FROM iasql_user_databases
    WHERE iasql_database_pg_name = '${dbAlias}';
  `, (row: any[]) => expect(row.length).toBe(1)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
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

