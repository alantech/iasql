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
const dbAlias = `${prefix}apigatewaytest`;

const nonDefaultRegion = 'us-east-1';
const apiName = `${dbAlias}testApiRegion`;

const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
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

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
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

  it('undo changes', commit());

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

  it('applies the change', commit());

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
      SET region = '${region}'
      WHERE name = '${apiName}';
  `),
  );

  it('applies the replacement', commit());

  it(
    'checks the API Gateway was moved',
    query(
      `
    SELECT *
    FROM api
    WHERE name = '${apiName}' and region = '${region}';
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

  it('applies the removal', commit());

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
