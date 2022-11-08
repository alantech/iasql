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
const dbAlias = 'dynamotest';

const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_dynamo'];

jest.setTimeout(960000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Dynamo Integration Testing', () => {
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
      false,
      () => ({ username, password }),
    ),
  );

  it('installs the dynamo module', install(modules));

  it(
    'creates a Dynamo table',
    query(`
    INSERT INTO dynamo_table (table_name, table_class, throughput, primary_key)
    VALUES (
      '${prefix}test',
      'STANDARD',
      '"PAY_PER_REQUEST"',
      '{"key": "S", "val": "S"}'
    );
  `),
  );

  it('undo changes', rollback());

  it(
    'checks it has been removed',
    query(
      `
    SELECT *
    FROM dynamo_table
    WHERE table_name = '${prefix}test';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'creates a Dynamo table',
    query(`
    INSERT INTO dynamo_table (table_name, table_class, throughput, primary_key)
    VALUES (
      '${prefix}test',
      'STANDARD',
      '"PAY_PER_REQUEST"',
      '{"key": "S", "val": "S"}'
    );
  `),
  );

  it('applies the change', commit());

  it(
    'checks the table was added',
    query(
      `
    SELECT *
    FROM dynamo_table
    WHERE table_name = '${prefix}test';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'changes the column definition',
    query(`
    UPDATE dynamo_table
    SET primary_key = '{"key": "S", "val": "N"}'
    WHERE table_name = '${prefix}test';
  `),
  );

  it('applies the change', commit());

  it('uninstalls the dynamo module', uninstall(['aws_dynamo']));

  it('installs the dynamo module', install(['aws_dynamo']));

  it(
    'check table count after uninstall',
    query(
      `
    SELECT *
    FROM dynamo_table
    WHERE table_name = '${prefix}test';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'removes the dynamo table',
    query(
      `
    DELETE FROM dynamo_table
    WHERE table_name = '${prefix}test';
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it(
    'checks the remaining table count',
    query(
      `
    SELECT *
    FROM dynamo_table
    WHERE table_name = '${prefix}test';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the change', commit());

  it(
    'checks the remaining table count again',
    query(
      `
    SELECT *
    FROM dynamo_table
    WHERE table_name = '${prefix}test';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'creates a table in a non-default region',
    query(`
    INSERT INTO dynamo_table (table_name, table_class, throughput, primary_key, region)
    VALUES (
      '${prefix}regiontest',
      'STANDARD',
      '"PAY_PER_REQUEST"',
      '{"key": "S", "val": "S"}',
      'us-east-1'
    );
  `),
  );

  it('applies the change', commit());

  it(
    'checks the table was added',
    query(
      `
    SELECT *
    FROM dynamo_table
    WHERE table_name = '${prefix}regiontest';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].region).toBe('us-east-1');
      },
    ),
  );

  it(
    'changes the region the table is located in',
    query(
      `
    UPDATE dynamo_table
    SET region = '${region}'
    WHERE table_name = '${prefix}regiontest';
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('applies the replacement', commit());

  it(
    'checks the table was moved',
    query(
      `
    SELECT *
    FROM dynamo_table
    WHERE table_name = '${prefix}regiontest';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].region).toBe(region);
      },
    ),
  );

  it(
    'removes the dynamo table',
    query(
      `
    DELETE FROM dynamo_table
    WHERE table_name = '${prefix}regiontest';
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('applies the removal', commit());

  it(
    'checks the remaining table count for the last time',
    query(
      `
    SELECT *
    FROM dynamo_table
    WHERE table_name = '${prefix}regiontest';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('Dynamo install/uninstall', () => {
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
    query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `),
  );

  it('installs the Dynamo module', install(modules));

  it('uninstalls the Dynamo module', uninstall(modules));

  it('installs all modules', done =>
    void iasql.install([], dbAlias, config.db.user, true).then(...finish(done)));

  it('uninstalls the Dynamo module', uninstall(['aws_rds']));

  it('installs the Dynamo module', install(['aws_rds']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
