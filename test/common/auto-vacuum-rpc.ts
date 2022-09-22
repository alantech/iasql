import * as iasql from '../../src/services/iasql';
import { runQuery, finish, execComposeUp, execComposeDown } from '../helpers';

const metadataQuery = runQuery.bind(null, 'iasql_metadata');
const dbAlias = 'metadatatest';
const uid = '12345';
const email = 'test@example.com';
const dbQuery = runQuery.bind(null, dbAlias);

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Testing auto vacuum rpcs', () => {
  it('creates a new test db', done => void iasql.connect(dbAlias, uid, email).then(...finish(done)));

  it(
    'check rpc db count',
    metadataQuery(
      `
    SELECT rpc_count
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `,
      (row: any[]) => expect(row[0].rpc_count).toBe(0),
    ),
  );

  it(
    'generate dummy rpcs',
    dbQuery(`
    INSERT INTO
      iasql_rpc (opid, module_name, method_name, params)
    SELECT
      gen_random_uuid(), 'test', 'test', array[]::text[]
    FROM
      generate_series(1,5002) i;
  `),
  );

  it(
    'check rpc db count',
    dbQuery(
      `
      SELECT *
      FROM iasql_rpc;
    `,
      (row: any[]) => expect(row.length).toBe(5002),
    ),
  );

  it(
    'update rpc date for the first row. Set the start_date 7 months behind since 6 month is the max allowed',
    dbQuery(`
    UPDATE iasql_rpc
    SET start_date = CURRENT_DATE - INTERVAL '7 months', module_name = 'test2'
    WHERE opid = (SELECT opid FROM iasql_rpc ORDER BY start_date ASC LIMIT 1);
  `),
  );

  it(
    'check rpc db count. Should be 5000 since it is the max amount of records allowed',
    dbQuery(
      `
    SELECT *
    FROM iasql_rpc
    WHERE module_name = 'test2';
  `,
      (row: any[]) => expect(row.length).toBe(1),
    ),
  );

  it(
    'force real rpc to run auto vacuum fn',
    dbQuery(`
    SELECT * FROM iasql_modules_list();
  `),
  );

  it(
    'check updated record has been deleted',
    dbQuery(
      `
    SELECT *
    FROM iasql_rpc
    WHERE module_name = 'test2';
  `,
      (row: any[]) => expect(row.length).toBe(0),
    ),
  );

  it(
    'check final rpc records. should be 5000 = 5002 - 1 old record - 2 due to the 4999 limit + 1 from the iasql_modules_list call',
    dbQuery(
      `
    SELECT *
    FROM iasql_rpc;
  `,
      (row: any[]) => expect(row.length).toBe(5000),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, uid).then(...finish(done)));
});
