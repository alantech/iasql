import { execSync } from 'child_process';

import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  getPrefix,
  runQuery,
  runInstall,
  runUninstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'ecrtest';
const repositoryName = prefix + dbAlias;
const region = 'us-east-1';
const pubRepositoryName = `pub${prefix}${dbAlias}-${process.env.AWS_REGION ?? 'barf'}`;
const policyMock =
  '{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer" ] } ]}';
const updatePolicyMock =
  '{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage" ] } ]}';
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_ecr'];
const dockerImage = 'public.ecr.aws/docker/library/hello-world:latest';
const repositoryTag = 'v1';

jest.setTimeout(240000);
beforeAll(async () => {
  // pull sample image
  execSync(
    `docker login --username AWS -p $(aws ecr-public get-login-password --region ${region}) public.ecr.aws`,
  );
  execSync(`docker pull ${dockerImage}`);

  await execComposeUp();
});
afterAll(async () => await execComposeDown());

describe('ECR Integration Testing', () => {
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

  it('installs the ecr module', install(modules));

  describe('private repository', () => {
    it(
      'adds a new repository',
      query(`
      INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
      VALUES ('${repositoryName}', false, 'MUTABLE');
    `),
    );

    it('undo changes', sync());

    it(
      'check adds a new repository',
      query(
        `
      SELECT *
      FROM repository
      WHERE repository_name = '${repositoryName}';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );

    it(
      'adds a new repository',
      query(`
      INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
      VALUES ('${repositoryName}', false, 'MUTABLE');
    `),
    );

    it(
      'check adds a new repository',
      query(
        `
      SELECT *
      FROM repository
      WHERE repository_name = '${repositoryName}';
    `,
        (res: any[]) => {
          expect(res.length).toBe(1);
          expect(res[0]['scan_on_push']).toBe(false);
          return expect(res[0]['image_tag_mutability']).toBe('MUTABLE');
        },
      ),
    );

    it('applies the repository change', apply());

    it(
      'pushes repository image',
      query(
        `SELECT repository_uri FROM repository WHERE repository_name='${repositoryName}'`,
        (res: any[]) => {
          // get repository uri to retag and pull
          const repositoryUri = res[0]['repository_uri'];
          execSync(`docker tag ${dockerImage} ${repositoryUri}`);
          execSync(
            `docker login --username AWS -p $(aws ecr get-login-password --region ${process.env.AWS_REGION}) ${repositoryUri}`,
          );

          execSync(`docker push ${repositoryUri}`);

          // upload with a new tag
          execSync(`docker tag ${dockerImage} ${repositoryUri}:${repositoryTag}`);
          execSync(`docker push ${repositoryUri}:${repositoryTag}`);
        },
      ),
    );

    it('syncs the images', sync());

    it(
      'check that new images has been created under a private repo',
      query(
        `
      SELECT *
      FROM repository_image
      WHERE private_repository = '${repositoryName}';
    `,
        (res: any[]) => {
          expect(res.length).toBe(2);
        },
      ),
    );

    it(
      'deletes image with a tag from a private repo',
      query(
        `DELETE FROM repository_image WHERE private_repository='${repositoryName}' AND image_tag='${repositoryTag}';`,
      ),
    );
    it('applies image delete change', apply());

    it(
      'check that image has been deleted properly',
      query(
        `
      SELECT *
      FROM repository_image
      WHERE private_repository = '${repositoryName}' AND image_tag='${repositoryTag}';
    `,
        (res: any[]) => {
          expect(res.length).toBe(0);
        },
      ),
    );

    it(
      'tries to update a repository autogenerated field',
      query(`
      UPDATE repository SET repository_arn = '${repositoryName}arn' WHERE repository_name = '${repositoryName}';
    `),
    );

    it('applies change which will undo it', apply());

    it(
      'tries to update a repository field',
      query(`
      UPDATE repository SET scan_on_push = true WHERE repository_name = '${repositoryName}';
    `),
    );

    it('applies the change', apply());

    it(
      'check adds a new repository',
      query(
        `
      SELECT *
      FROM repository
      WHERE repository_name = '${repositoryName}';
    `,
        (res: any[]) => {
          expect(res.length).toBe(1);
          return expect(res[0]['scan_on_push']).toBe(true);
        },
      ),
    );

    it(
      'adds a new repository policy',
      query(`
      INSERT INTO repository_policy (repository_name, policy_text)
      VALUES ('${repositoryName}', '${policyMock}');
    `),
    );

    it('applies the change', apply());

    it(
      'check adds a new repository policy',
      query(
        `
      SELECT *
      FROM repository_policy
      WHERE repository_name = '${repositoryName}';
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );

    it(
      'tries to update a repository policy autogenerated field',
      query(`
      UPDATE repository_policy
      SET registry_id = '${repositoryName}registry'
      WHERE repository_name = '${repositoryName}';
    `),
    );

    it('applies change which will undo it', apply());

    it(
      'tries to update a repository field',
      query(`
      UPDATE repository_policy
      SET policy_text = '${updatePolicyMock}'
      WHERE repository_name = '${repositoryName}';
    `),
    );

    it('applies the change', apply());

    it(
      'deletes the repository policy',
      query(`
      DELETE FROM repository_policy
      WHERE repository_name = '${repositoryName}';
    `),
    );

    it('applies the delete repository policy', apply());

    it(
      'check deletes the repository policy',
      query(
        `
      SELECT *
      FROM repository_policy
      WHERE repository_name = '${repositoryName}';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );

    it('uninstalls the ecr module', uninstall(modules));

    it('installs the ecr module', install(modules));

    it(
      'deletes the repository images',
      query(`
    DELETE FROM repository_image WHERE private_repository= '${repositoryName}';
  `),
    );

    it(
      'deletes the repository',
      query(`
      DELETE FROM repository
      WHERE repository_name = '${repositoryName}';
    `),
    );

    it('applies deletes the repository', apply());

    it(
      'check deletes the repository',
      query(
        `
      SELECT scan_on_push, image_tag_mutability
      FROM repository
      WHERE repository_name = '${repositoryName}';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );
  });

  describe('public repository', () => {
    it(
      'adds a new public repository',
      query(`
      INSERT INTO public_repository (repository_name)
      VALUES ('${pubRepositoryName}');
    `),
    );

    it('undo changes', sync());

    it(
      'check adds a new public repository',
      query(
        `
      SELECT *
      FROM public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );

    it(
      'adds a new public repository',
      query(`
      INSERT INTO public_repository (repository_name)
      VALUES ('${pubRepositoryName}');
    `),
    );

    it(
      'check adds a new public repository',
      query(
        `
      SELECT *
      FROM public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );

    it('applies the public repository change', apply());

    it(
      'pushes public repository image',
      query(
        `SELECT repository_uri FROM public_repository WHERE repository_name='${pubRepositoryName}'`,
        (res: any[]) => {
          // get repository uri to retag and pull
          const repositoryUri = res[0]['repository_uri'];
          execSync(`docker tag ${dockerImage} ${repositoryUri}`);
          execSync(
            `docker login --username AWS -p $(aws ecr-public get-login-password --region ${region}) ${repositoryUri}`,
          );

          execSync(`docker push ${repositoryUri}`);
        },
      ),
    );

    it('syncs the images', sync());

    it(
      'check that new images has been created under a public repo',
      query(
        `
      SELECT *
      FROM repository_image
      WHERE public_repository = '${pubRepositoryName}';
    `,
        (res: any[]) => {
          expect(res.length).toBe(1);
        },
      ),
    );

    it(
      'tries to update a public repository autogenerated field',
      query(`
      UPDATE public_repository SET repository_arn = '${pubRepositoryName}arn' WHERE repository_name = '${pubRepositoryName}';
    `),
    );

    it('applies change which will undo it', apply());

    it(
      'check update public repository (noop)',
      query(
        `
      SELECT *
      FROM public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );

    it('uninstalls the ecr module', uninstall(modules));

    it('installs the ecr module', install(modules));

    it(
      'deletes the repository images',
      query(`
    DELETE FROM repository_image WHERE public_repository= '${pubRepositoryName}';
  `),
    );

    it(
      'deletes the public repository',
      query(`
      DELETE FROM public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `),
    );

    it('applies the log group change (last time)', apply());

    it(
      'check deletes the public repository',
      query(
        `
      SELECT *
      FROM public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );
  });

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('ECR install/uninstall', () => {
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

  it('installs the ECR module', install(modules));

  it('uninstalls the ECR module', uninstall(modules));

  it('installs all modules', done =>
    void iasql.install([], dbAlias, config.db.user, true).then(...finish(done)));

  it('uninstalls the ECR module', uninstall(['aws_ecr', 'aws_codebuild', 'aws_ecs_fargate', 'aws_ecs_simplified']));

  it('installs the ECR module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
