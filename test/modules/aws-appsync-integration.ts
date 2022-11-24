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
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = `${prefix}appsynctest`;

const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_appsync'];
const apiName = `${prefix}testApi`;
const {
  AuthenticationType,
} = require(`../../src/modules/${config.modules.latestVersion}/aws_appsync/entity`);

const authType = AuthenticationType.API_KEY;
const newAuthType = AuthenticationType.AWS_IAM;

jest.setTimeout(3600000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('App Sync Integration Testing', () => {
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
    SELECT * FROM iasql_begin();
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
    SELECT * FROM iasql_begin();
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the App Sync module', install(modules));

  it(
    'adds a new Graphql API',
    query(
      `  
    SELECT * FROM iasql_begin();
  
    INSERT INTO graphql_api (name, authentication_type)
    VALUES ('${apiName}', '${authType}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'adds a new GraphQL API entry',
    query(
      `  
    SELECT * FROM iasql_begin();
  
    INSERT INTO graphql_api (name, authentication_type)
    VALUES ('${apiName}', '${authType}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the Graphql API change', commit());

  it(
    'check Graphql API is available',
    query(
      `
  SELECT * FROM graphql_api WHERE name='${apiName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update Graphql API auth type',
    query(
      `
  SELECT * FROM iasql_begin();
  UPDATE graphql_api SET authentication_type='${newAuthType}' WHERE name='${apiName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the Graphql API auth type update', commit());

  it(
    'checks that Graphql API has been been modified',
    query(
      `
  SELECT * FROM graphql_api WHERE authentication_type='${newAuthType}' and name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update Graphql API ID',
    query(
      `
  SELECT * FROM iasql_begin();
  UPDATE graphql_api SET api_id='fake' WHERE name='${apiName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the Graphql API ID update', commit());

  it(
    'checks that Graphql API ID has not been been modified',
    query(
      `
  SELECT * FROM graphql_api WHERE api_id='fake' AND name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('uninstalls the API module', uninstall(modules));

  it('installs the Graphql API module again (to make sure it reloads stuff)', install(modules));

  it(
    'checks Graphql API count',
    query(
      `
    SELECT * FROM graphql_api WHERE name='${apiName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'deletes the Graphql API',
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM graphql_api
    WHERE name = '${apiName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the Graphql API removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('API install/uninstall', () => {
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
    SELECT * FROM iasql_begin();
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
    SELECT * FROM iasql_begin();
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the API module', install(modules));

  it('uninstalls the API module', uninstall(modules));

  it('installs all modules', done =>
    void iasql.install([], dbAlias, config.db.user, true).then(...finish(done)));

  it('uninstalls the API module', uninstall(['aws_appsync']));

  it('installs the API module', install(['aws_appsync']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
