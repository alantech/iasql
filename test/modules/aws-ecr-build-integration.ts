import { AWS } from '../../src/services/aws_macros';
import * as iasql from '../../src/services/iasql';
import {
  getPrefix,
  runQuery,
  runCommit,
  finish,
  execComposeUp,
  execComposeDown,
  runInstall,
  defaultRegion,
  runBegin,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'ecrbuildertest';
const repositoryName = prefix + dbAlias;
const region = defaultRegion();

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const modules = ['aws_ecr', 'aws_iam'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('AwsEcrBuild Integration Testing', () => {
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

  it('starts a transaction', begin());

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
      UPDATE aws_regions
      SET is_default = TRUE
      WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the ecr module', install(modules));

  it('starts a transaction', begin());

  it(
    'creates a new ecr repository',
    query(
      `
      INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
      VALUES ('${repositoryName}', false, 'MUTABLE');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the creation of ecr repository', commit());

  it(
    'builds hello world image and pushes to the new ecr repo',
    query(`
      SELECT ecr_build(
                     'https://github.com/iasql/docker-helloworld',
                     (SELECT id FROM repository WHERE repository_name = '${repositoryName}')::varchar(255),
                     '.',
                     'main',
                     '${process.env.GH_PAT}'
                 );
  `),
  );

  it(
    'checks if the image is created in the database',
    query(
      `
      SELECT image_tag
      FROM repository_image
      WHERE private_repository_id = (SELECT id FROM repository WHERE repository_name = '${repositoryName}');
  `,
      (res: any) => {
        expect(res.length).toBe(1);
        expect(res[0].image_tag === 'latest');
      },
    ),
  );

  it('starts a transaction', begin());

  it('syncs the cloud state', commit());

  it(
    'checks if the image is still there after sync',
    query(
      `
      SELECT image_tag
      FROM repository_image
      WHERE private_repository_id = (SELECT id FROM repository WHERE repository_name = '${repositoryName}');
  `,
      (res: any) => {
        expect(res.length).toBe(1);
        expect(res[0].image_tag === 'latest');
      },
    ),
  );

  it(
    'checks if there is no iam role leftover',
    query(
      `
      SELECT role_name
      FROM iam_role
      WHERE role_name LIKE '%-ecr-builder-codebuild-role';
  `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('checks if the codebuild project is deleted', async () => {
    const client = new AWS({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const projects = (await client.cbClient.listProjects({})).projects;
    projects?.map(name => expect(name).not.toMatch(/-ecr-builder$/));
  });

  it('starts a transaction', begin());

  it(
    'deletes the image',
    query(
      `
      DELETE
      FROM repository_image
      WHERE private_repository_id = (SELECT id FROM repository WHERE repository_name = '${repositoryName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply image deletion', commit());

  it(
    'checks if the image is deleted in the database',
    query(
      `
      SELECT *
      FROM repository_image
      WHERE private_repository_id = (SELECT id FROM repository WHERE repository_name = '${repositoryName}');
  `,
      (res: any) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it(
    'builds hello world image and pushes to the new ecr repo without Github personal access token',
    query(`
      SELECT ecr_build(
                     'https://github.com/iasql/docker-helloworld',
                     (SELECT id FROM repository WHERE repository_name = '${repositoryName}')::varchar(255),
                     '.',
                     'main',
                     ''
                 );
  `),
  );

  it(
    'checks if the image is created in the database',
    query(
      `
      SELECT image_tag
      FROM repository_image
      WHERE private_repository_id = (SELECT id FROM repository WHERE repository_name = '${repositoryName}');
  `,
      (res: any) => {
        expect(res.length).toBe(1);
        expect(res[0].image_tag === 'latest');
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the image',
    query(
      `
      DELETE
      FROM repository_image
      WHERE private_repository_id = (SELECT id FROM repository WHERE repository_name = '${repositoryName}');
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it(
    'deletes the repository',
    query(
      `
      DELETE
      FROM repository
      WHERE repository_name = '${repositoryName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the deletion of resources', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
