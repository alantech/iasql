import { AuthenticationType } from '../../src/modules/aws_appsync/entity';
import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runBegin,
  runCommit,
  runInstall,
  runQuery,
  runRollback,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'appsynctest';

const nonDefaultRegion = 'us-east-1';
const apiName = `${prefix}${dbAlias}region`;
const authType = AuthenticationType.API_KEY;

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_appsync'];

jest.setTimeout(3600000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('App Sync Multi-region Integration Testing', () => {
  it('creates a new test db', done => {
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

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the app sync module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new Graphql API',
    query(
      `
    INSERT INTO graphql_api (name, authentication_type, region)
    VALUES ('${apiName}', '${authType}', '${nonDefaultRegion}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'checks it has been removed',
    query(
      `
    SELECT *
    FROM graphql_api
    WHERE name = '${apiName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a new Graphql API',
    query(
      `
    INSERT INTO graphql_api (name, authentication_type, region)
    VALUES ('${apiName}', '${authType}', '${nonDefaultRegion}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'checks the graphql api was added',
    query(
      `
      SELECT *
      FROM graphql_api
      WHERE name = '${apiName}' and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'changes the region the graphql api is located in',
    query(
      `
      UPDATE graphql_api
      SET region = '${region}'
      WHERE name = '${apiName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the replacement', commit());

  it(
    'checks the graphql api was moved',
    query(
      `
    SELECT *
    FROM graphql_api
    WHERE name = '${apiName}' and region = '${region}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'creates a graphql api in the original region',
    query(`
    INSERT INTO graphql_api (name, authentication_type, region)
    VALUES ('${apiName}', '${authType}', '${nonDefaultRegion}');
  `),
  );

  it('applies the addition', commit());

  it('starts a transaction', begin());

  it(
    'removes the graphql api',
    query(
      `
    DELETE FROM graphql_api
    WHERE name = '${apiName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the removal', commit());

  it(
    'checks the remaining table count for the last time',
    query(
      `
    SELECT *
    FROM graphql_api
    WHERE name = '${apiName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
