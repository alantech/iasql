import * as iasql from '../../src/services/iasql';
import MetadataRepo from '../../src/services/repositories/metadata';
import {
  runCommit,
  runInstall,
  runQuery,
  finish,
  execComposeUp,
  execComposeDown,
  runBegin,
} from '../helpers';

const metadataQuery = runQuery.bind(null, 'iasql_metadata');
const dbAlias = 'metadatatest';
const uid = '12345';
const email = 'test@example.com';
const dbQuery = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const begin = runBegin.bind(null, dbAlias);

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Testing metadata repo', () => {
  it(
    'no users should exist',
    metadataQuery(
      `
    SELECT *
    FROM iasql_user
  `,
      (row: any[]) => expect(row.length).toBe(0),
    ),
  );

  it('list dbs', done => void MetadataRepo.getDbs(uid, email).then(...finish(done)));

  it(
    'user should exist after listing databases',
    metadataQuery(
      `
    SELECT *
    FROM iasql_user;
  `,
      (row: any[]) => expect(row.length).toBe(1),
    ),
  );

  it(
    'no database should exist',
    metadataQuery(
      `
    SELECT *
    FROM iasql_database;
  `,
      (row: any[]) => expect(row.length).toBe(0),
    ),
  );

  it('creates a new test db', done => void iasql.connect(dbAlias, uid, email).then(...finish(done)));

  it(
    'check row in iasql database table exists',
    metadataQuery(
      `
    SELECT *
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `,
      (row: any[]) => expect(row.length).toBe(1),
    ),
  );

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
    'check rec db count',
    metadataQuery(
      `
    SELECT record_count
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `,
      (row: any[]) => expect(row[0].record_count).toBe(0),
    ),
  );

  it(
    'check row in join table exists',
    metadataQuery(
      `
    SELECT *
    FROM iasql_user_databases
    WHERE iasql_database_pg_name = '${dbAlias}';
  `,
      async (row: any[]) => {
        expect(row.length).toBe(1);
        const user = await MetadataRepo.getUserFromDbId(dbAlias);
        expect(user?.id).toBe(uid);
      },
    ),
  );

  it('installs the aws_account module', install(['aws_account']));

  it(
    'check rpc db count',
    metadataQuery(
      `
    SELECT rpc_count
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `,
      (row: any[]) => expect(row[0].rpc_count).toBe(1),
    ),
  );

  it(
    'inserts aws credentials',
    dbQuery(
      `
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
    ),
  );

  it('starts a transaction', begin());

  it('apply updates db counts', commit());

  it(
    'check rpc db count',
    metadataQuery(
      `
    SELECT rpc_count
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `,
      (row: any[]) => expect(row[0].rpc_count).toBe(2),
    ),
  );

  it(
    'check rec db count',
    metadataQuery(
      `
    SELECT record_count
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `,
      (row: any[]) => expect(row[0].record_count).toBeGreaterThan(1),
    ),
  ); // The regions table should be filled during the `apply`

  it('deletes the test db', done => void iasql.disconnect(dbAlias, uid).then(...finish(done)));

  it(
    'check there is no row in iasql database',
    metadataQuery(
      `
    SELECT *
    FROM iasql_database
    WHERE pg_name = '${dbAlias}';
  `,
      (row: any[]) => expect(row.length).toBe(0),
    ),
  );

  it(
    'check there is no row in join table',
    metadataQuery(
      `
    SELECT *
    FROM iasql_user_databases
    WHERE iasql_database_pg_name = '${dbAlias}';
  `,
      (row: any[]) => expect(row.length).toBe(0),
    ),
  );
});
