import * as iasql from '../../src/services/iasql';
import {
  getPrefix,
  runQuery,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
  runInstall,
  runUninstall,
  getKeyCertPair,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'ecrbuildertest';
const repositoryName = prefix + dbAlias;


const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_ecr'];


jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('AwsEcrBuild Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
      INSERT INTO aws_credentials (access_key_id, secret_access_key)
      VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
      UPDATE aws_regions
      SET is_default = TRUE
      WHERE region = '${process.env.AWS_REGION}';
  `));

  it('installs the ecr module', install(modules));

  it('creates a new ecr repository', query(`
      INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
      VALUES ('${repositoryName}', false, 'MUTABLE');
  `));

  it('applies the creation of ecr repository', apply());

  it('tries to call ecr_build without aws_iam installed', (done) => {
    try {
      query(`
          SELECT ecr_build(
                         'https://github.com/karthequian/docker-helloworld',
                         (SELECT id FROM repository WHERE repository_name = '${repositoryName}')::varchar(255),
                         '.',
                         NULL,
                         'master'
                     );
      `, (res: any) => expect(res).toThrowError());
    } catch (e: any) {
      expect(e.message).toContain('ecr_build RPC is only available if you have "aws_iam" module installed');
      done();
    }
  });
});