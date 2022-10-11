import * as iasql from '../../src/services/iasql';
import {
  execComposeDown,
  execComposeUp,
  finish,
  runApply,
  runInstall,
  runQuery,
  runSync,
  runUninstall,
} from '../helpers';

const dbAlias = 'codepipelinetest';
const apply = runApply.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const modules = ['aws_codepipeline'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('AwsCodepipeline Integration Testing', () => {
  it('creates a new test db with the same name', done =>
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

  it('installs the codepipeline module', install(modules));

  it(
    'adds a new pipeline',
    query(`
    INSERT INTO pipeline_declaration (name)
    VALUES ('${dbAlias}');
  `),
  );

  it('apply pipeline creation', apply());

  it(
    'check pipeline is created',
    query(
      `
    SELECT * FROM pipeline_declaration
    WHERE name = '${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('uninstalls the codepipeline module', uninstall(modules));

  it('installs the codepipeline module', install(modules));

  it(
    'delete pipeline',
    query(`
    DELETE FROM pipeline_declaration
    WHERE name = '${dbAlias}';
  `),
  );

  it('apply deletions', apply());

  it(
    'check pipeline list is empty',
    query(
      `
    SELECT * FROM pipeline_declaration
    WHERE project_name = '${dbAlias}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('AwsCodepipeline install/uninstall', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `),
  );

  it('installs the codepipeline module', install(modules));

  it('uninstalls the codepipeline module', uninstall(modules));

  it('installs all modules', done => void iasql.install([], dbAlias, 'postgres', true).then(...finish(done)));

  it('uninstalls the codepipeline module', uninstall(['aws_codepipeline']));

  it('installs the codepipeline module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
