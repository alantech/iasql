import { execSync } from 'child_process';

import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runBegin,
  runCommit,
  runInstall,
  runInstallAll,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'ecrtest';
const repositoryName = prefix + dbAlias;
const publicRegion = 'us-east-1';
const region = defaultRegion();
const pubRepositoryName = `pub${prefix}${dbAlias}-${region}`;
const policyMock =
  '{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer" ] } ]}';
const updatePolicyMock =
  '{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage" ] } ]}';
const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_ecr'];
const dockerImage = 'public.ecr.aws/docker/library/hello-world:latest';
// Custom digest for linux/386
const dockerImageUpdated =
  'public.ecr.aws/docker/library/hello-world@sha256:995efde2e81b21d1ea7066aa77a59298a62a9e9fbb4b77f36c189774ec9b1089';
const repositoryTag = 'v1';

jest.setTimeout(360000);
beforeAll(async () => {
  // pull sample image
  execSync(
    `docker login --username AWS -p $(aws ecr-public get-login-password --region ${publicRegion}) public.ecr.aws`,
  );
  execSync(`docker pull ${dockerImage}`);
  execSync(`docker pull ${dockerImageUpdated}`);

  await execComposeUp();
});
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('ECR Integration Testing', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the ecr module', install(modules));

  describe('private repository', () => {
    it('starts a transaction', begin());

    it(
      'adds a new repository',
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

    it('undo changes', rollback());

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

    it('starts a transaction', begin());

    it(
      'adds a new repository',
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

    it('applies the repository change', commit());

    it('starts a transaction', begin());

    it(
      'pushes repository image',
      query(
        `SELECT repository_uri FROM repository WHERE repository_name='${repositoryName}'`,
        (res: any[]) => {
          // get repository uri to retag and pull
          const repositoryUri = res[0]['repository_uri'];
          execSync(`docker tag ${dockerImage} ${repositoryUri}`);
          execSync(
            `docker login --username AWS -p $(aws ecr get-login-password --region ${region}) ${repositoryUri}`,
          );
          execSync(`docker push ${repositoryUri}`);
          // We push a different image with the same tag to leave the previous one untagged
          execSync(`docker tag ${dockerImageUpdated} ${repositoryUri}`);
          execSync(`docker push ${repositoryUri}`);

          // upload with a new tag
          execSync(`docker tag ${dockerImageUpdated} ${repositoryUri}:${repositoryTag}`);
          execSync(`docker push ${repositoryUri}:${repositoryTag}`);
        },
      ),
    );

    it('syncs the images', commit());

    it(
      'check that new images has been created under a private repo',
      query(
        `
      SELECT *
      FROM repository_image
      WHERE private_repository_id = (select id from repository where repository_name = '${repositoryName}');
    `,
        (res: any[]) => {
          console.dir(res)
          console.log('burts')
          expect(res.length).toBe(3);
          expect(res.filter(i => i['image_tag'] === '<untagged>').length).toBe(1);
        },
      ),
    );

    it('starts a transaction', begin());

    it(
      'deletes image with a tag from a private repo',
      query(
        `DELETE FROM repository_image WHERE private_repository_id = (select id from repository where repository_name = '${repositoryName}') AND image_tag='${repositoryTag}';`,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );
    it('applies image delete change', commit());

    it(
      'check that image has been deleted properly',
      query(
        `
      SELECT *
      FROM repository_image
      WHERE private_repository_id = (select id from repository where repository_name = '${repositoryName}') AND image_tag='${repositoryTag}';
    `,
        (res: any[]) => {
          expect(res.length).toBe(0);
        },
      ),
    );

    it('starts a transaction', begin());

    it(
      'tries to update a repository autogenerated field',
      query(
        `
      UPDATE repository SET repository_arn = '${repositoryName}arn' WHERE repository_name = '${repositoryName}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies change which will undo it', commit());

    it('starts a transaction', begin());

    it(
      'tries to update a repository field',
      query(
        `
      UPDATE repository SET scan_on_push = true WHERE repository_name = '${repositoryName}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the change', commit());

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

    it('starts a transaction', begin());

    it(
      'adds a new repository policy',
      query(
        `
      INSERT INTO repository_policy (repository_id, policy_text)
      VALUES ((select id from repository where repository_name = '${repositoryName}'), '${policyMock}');
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the change', commit());

    it(
      'check adds a new repository policy',
      query(
        `
      SELECT *
      FROM repository_policy
      WHERE repository_id = (select id from repository where repository_name = '${repositoryName}');
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );

    it('starts a transaction', begin());

    it(
      'tries to update a repository policy autogenerated field',
      query(
        `
      UPDATE repository_policy
      SET registry_id = '${repositoryName}registry'
      WHERE repository_id = (select id from repository where repository_name = '${repositoryName}');
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies change which will undo it', commit());

    it('starts a transaction', begin());

    it(
      'tries to update a repository field',
      query(
        `
      UPDATE repository_policy
      SET policy_text = '${updatePolicyMock}'
      WHERE repository_id = (select id from repository where repository_name = '${repositoryName}');
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the change', commit());

    it('starts a transaction', begin());

    it(
      'deletes the repository policy',
      query(
        `
      DELETE FROM repository_policy
      WHERE repository_id = (select id from repository where repository_name = '${repositoryName}');
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the delete repository policy', commit());

    it(
      'check deletes the repository policy',
      query(
        `
      SELECT *
      FROM repository_policy
      WHERE repository_id = (select id from repository where repository_name = '${repositoryName}');
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );

    it('uninstalls the ecr module', uninstall(modules));

    it('installs the ecr module', install(modules));

    it('starts a transaction', begin());

    it(
      'deletes the repository images',
      query(
        `
    DELETE FROM repository_image WHERE private_repository_id = (select id from repository where repository_name = '${repositoryName}');
  `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it(
      'deletes the repository',
      query(
        `
      DELETE FROM repository
      WHERE repository_name = '${repositoryName}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies deletes the repository', commit());

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
    it('starts a transaction', begin());

    it(
      'adds a new public repository',
      query(
        `
      INSERT INTO public_repository (repository_name)
      VALUES ('${pubRepositoryName}');
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('undo changes', rollback());

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

    it('starts a transaction', begin());

    it(
      'adds a new public repository',
      query(
        `
      INSERT INTO public_repository (repository_name)
      VALUES ('${pubRepositoryName}');
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
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

    it('applies the public repository change', commit());

    it('starts a transaction', begin());

    it(
      'pushes public repository image',
      query(
        `SELECT repository_uri FROM public_repository WHERE repository_name='${pubRepositoryName}'`,
        (res: any[]) => {
          // get repository uri to retag and pull
          const repositoryUri = res[0]['repository_uri'];
          execSync(`docker tag ${dockerImage} ${repositoryUri}`);
          execSync(
            `docker login --username AWS -p $(aws ecr-public get-login-password --region ${publicRegion}) ${repositoryUri}`,
          );

          execSync(`docker push ${repositoryUri}`);
        },
      ),
    );

    it('syncs the images', commit());

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

    it('starts a transaction', begin());

    it(
      'tries to update a public repository autogenerated field',
      query(
        `
      UPDATE public_repository SET repository_arn = '${pubRepositoryName}arn' WHERE repository_name = '${pubRepositoryName}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies change which will undo it', commit());

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

    it('starts a transaction', begin());

    it(
      'deletes the repository images',
      query(
        `
    DELETE FROM repository_image WHERE public_repository= '${pubRepositoryName}';
  `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it(
      'deletes the public repository',
      query(
        `
      DELETE FROM public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the log group change (last time)', commit());

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
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the ECR module', install(modules));

  it('uninstalls the ECR module', uninstall(modules));

  it('installs all modules', installAll());

  it(
    'uninstalls the ECR module',
    uninstall(['aws_ecr', 'aws_codebuild', 'aws_ecs_fargate', 'aws_ecs_simplified']),
  );

  it('installs the ECR module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
