import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  getPrefix,
  runQuery,
  runApply,
  runInstall,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = `${prefix}apigatewaytest`;

const nonDefaultRegion = 'us-east-1';
const apiName = `${dbAlias}testApiRegion`;

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const modules = ['aws_api_gateway'];

jest.setTimeout(3600000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Api Gateway Multi-region Integration Testing', () => {
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

  it('syncs the regions', sync());

  it(
    'sets the default region',
    query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${process.env.AWS_REGION}';
  `),
  );

  it('installs the api gateway module', install(modules));

  it(
    'adds a new API Gateway',
    query(`  
    INSERT INTO api (name, description, region)
    VALUES ('${apiName}', 'description', '${nonDefaultRegion}');
  `),
  );

  it('undo changes', sync());

  it(
    'checks it has been removed',
    query(
      `
    SELECT *
    FROM api
    WHERE name = '${apiName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'adds a new API Gateway',
    query(`  
    INSERT INTO api (name, description, region)
    VALUES ('${apiName}', 'description', '${nonDefaultRegion}');
  `),
  );

  it('applies the change', apply());

  it(
    'checks the API Gateway was added',
    query(
      `
      SELECT *
      FROM api
      WHERE name = '${apiName}' and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'changes the region the API Gateway is located in',
    query(`
      UPDATE api
      SET region = '${process.env.AWS_REGION}'
      WHERE name = '${apiName}';
  `),
  );

  it('applies the replacement', apply());

  it(
    'checks the API Gateway was moved',
    query(
      `
    SELECT *
    FROM api
    WHERE name = '${apiName}' and region = '${process.env.AWS_REGION}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'removes the API Gateway',
    query(`
    DELETE FROM api
    WHERE name = '${apiName}';
  `),
  );

  it('applies the removal', apply());

  it(
    'checks the remaining table count for the last time',
    query(
      `
    SELECT *
    FROM api
    WHERE name = '${apiName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
