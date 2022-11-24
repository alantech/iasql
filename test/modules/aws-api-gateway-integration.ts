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
const dbAlias = `${prefix}apigatewaytest`;

const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_api_gateway'];
// the AWS website lied, API gateway also has restricted regions
const region = defaultRegion([
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ca-central-1',
  'eu-central-1',
  'eu-north-1',
  'eu-west-1',
  'eu-west-2',
  'sa-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
]);
const apiName = `${prefix}testApi`;

jest.setTimeout(3600000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('API Gateway Integration Testing', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the API gateway module', install(modules));

  it(
    'adds a new API gateway',
    query(
      `  
    SELECT * FROM iasql_begin();
  
    INSERT INTO api (name, description)
    VALUES ('${apiName}', 'description');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'adds a new API gateway',
    query(
      `  
    SELECT * FROM iasql_begin();
  
    INSERT INTO api (name, description, disable_execute_api_endpoint, version)
    VALUES ('${apiName}', 'description', false, '1.0');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the API gateway change', commit());

  it(
    'check API gateway is available',
    query(
      `
  SELECT * FROM api WHERE name='${apiName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update API description',
    query(
      `
  SELECT * FROM iasql_begin();
  UPDATE api SET description='new description' WHERE name='${apiName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the API description update', commit());

  it(
    'checks that API has been been modified',
    query(
      `
  SELECT * FROM api WHERE description='new description' and name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update API ID',
    query(
      `
  SELECT * FROM iasql_begin();
  UPDATE api SET api_id='fake' WHERE name='${apiName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the API ID update', commit());

  it(
    'checks that API ID has not been been modified',
    query(
      `
  SELECT * FROM api WHERE api_id='fake' AND name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'tries to update the API protocol',
    query(
      `
  SELECT * FROM iasql_begin();
  UPDATE api SET protocol_type='WEBSOCKET' WHERE name='${apiName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the API protocol update', commit());

  it(
    'checks that API protocol has not been been modified',
    query(
      `
  SELECT * FROM api WHERE protocol_type='HTTP' AND name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );
  it(
    'checks that API protocol has not been been modified',
    query(
      `
  SELECT * FROM api WHERE protocol_type='WEBSOCKET' AND name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('uninstalls the API module', uninstall(modules));

  it('installs the API module again (to make sure it reloads stuff)', install(modules));

  it(
    'checks API count',
    query(
      `
    SELECT * FROM api WHERE name='${apiName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'deletes the API',
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM api
    WHERE name = '${apiName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the API removal', commit());

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

  it('uninstalls the API module', uninstall(['aws_api_gateway']));

  it('installs the API module', install(['aws_api_gateway']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
