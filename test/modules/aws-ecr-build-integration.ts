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
import { AWS } from '../../src/services/aws_macros';

const prefix = getPrefix();
const dbAlias = 'ecrbuildertest';
const repositoryName = prefix + dbAlias;


const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_ecr', 'aws_iam'];


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

  it('builds hello world image and pushes to the new ecr repo', query(`
      SELECT ecr_build(
                     'https://github.com/karthequian/docker-helloworld',
                     (SELECT id FROM repository WHERE repository_name = '${repositoryName}')::varchar(255),
                     '.',
                     '${process.env.GH_PAT}',
                     'master'
                 );
  `));

  it('checks if the image is created in the database', query(`
      SELECT image_tag
      FROM repository_image
      WHERE private_repository_id = (SELECT id FROM repository WHERE repository_name = '${repositoryName}');
  `, (res: any) => {
    expect(res.length).toBe(1);
    expect(res[0].image_tag === 'latest');
  }));

  it('syncs the cloud state', sync());

  it('checks if the image is still there after sync', query(`
      SELECT image_tag
      FROM repository_image
      WHERE private_repository_id = (SELECT id FROM repository WHERE repository_name = '${repositoryName}');
  `, (res: any) => {
    expect(res.length).toBe(1);
    expect(res[0].image_tag === 'latest');
  }));

  it('checks if there is no iam role leftover', query(`
      SELECT role_name
      FROM iam_role
      WHERE role_name LIKE '%-ecr-builder-codebuild-role';
  `, (res: any) => expect(res.length).toBe(0)));

  it('checks if the codebuild project is deleted', async () => {
    const client = new AWS({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const projects = (await client.cbClient.listProjects({})).projects;
    projects?.map(name => expect(name).not.toMatch(/-ecr-builder$/));
  });

  it('deletes the image', query(`
      DELETE
      FROM repository_image
      WHERE private_repository_id = (SELECT id FROM repository WHERE repository_name = '${repositoryName}');
  `));

  it('deletes the repository', query(`
      DELETE
      FROM repository
      WHERE repository_name = '${repositoryName}'
  `));

  it('applies the deletion of resources', apply());

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});