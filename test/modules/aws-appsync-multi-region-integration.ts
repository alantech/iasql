import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runCommit,
  runInstall,
  runQuery,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'appsynctest';

const nonDefaultRegion = 'us-east-1';
const apiName = `${prefix}${dbAlias}region`;
const {
  AuthenticationType,
} = require(`../../src/modules/${config.modules.latestVersion}/aws_appsync/entity`);
const authType = AuthenticationType.API_KEY;

const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_appsync'];

jest.setTimeout(3600000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('App Sync Multi-region Integration Testing', () => {
  it('creates a new test db', done =>
    void iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

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
    ),
  );

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `),
  );

  it('installs the app sync module', install(modules));

  it(
    'adds a new Graphql API',
    query(`  
    INSERT INTO graphql_api (name, authentication_type, region)
    VALUES ('${apiName}', '${authType}', '${nonDefaultRegion}');
  `),
  );

  it('undo changes', commit());

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

  it(
    'adds a new Graphql API',
    query(`  
    INSERT INTO graphql_api (name, authentication_type, region)
    VALUES ('${apiName}', '${authType}', '${nonDefaultRegion}');
  `),
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

  it(
    'changes the region the graphql api is located in',
    query(`
      UPDATE graphql_api
      SET region = '${region}'
      WHERE name = '${apiName}';
  `),
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

  it('creates a graphql api in the original region', query(`
    INSERT INTO graphql_api (name, authentication_type, region)
    VALUES ('${apiName}', '${authType}', '${nonDefaultRegion}');
  `));

  it('applies the addition', apply());

  it(
    'removes the graphql apis',
    query(`
    DELETE FROM graphql_api
    WHERE name = '${apiName}';
  `),
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
