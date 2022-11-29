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
  runQuery,
  runRollback,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'ecrtest';
const repositoryName = `${prefix}${dbAlias}`;
const region = defaultRegion();
const nonDefaultRegion = 'us-east-1';
const policyMock =
  '{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer" ] } ]}';

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_ecr'];
const dockerImage = 'public.ecr.aws/docker/library/hello-world:latest';

jest.setTimeout(360000);
beforeAll(async () => {
  // pull sample image
  execSync(
    `docker login --username AWS -p $(aws ecr-public get-login-password --region ${nonDefaultRegion}) public.ecr.aws`,
  );
  execSync(`docker pull ${dockerImage}`);

  await execComposeUp();
});
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('ECR Multi-region Integration Testing', () => {
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

  it('installs the ECR module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new repository',
    query(
      `  
    INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability, region)
      VALUES ('${repositoryName}', false, 'MUTABLE', '${nonDefaultRegion}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'checks it has been removed',
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
      INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability, region)
      VALUES ('${repositoryName}', false, 'MUTABLE', '${nonDefaultRegion}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'checks the repository was added',
    query(
      `
      SELECT *
      FROM repository
      WHERE repository_name = '${repositoryName}' and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'pushes repository image',
    query(
      `SELECT repository_uri FROM repository WHERE repository_name='${repositoryName}' and region = '${nonDefaultRegion}'`,
      (res: any[]) => {
        // get repository uri to retag and pull
        const repositoryUri = res[0]['repository_uri'];
        execSync(`docker tag ${dockerImage} ${repositoryUri}`);
        execSync(
          `docker login --username AWS -p $(aws ecr get-login-password --region ${nonDefaultRegion}) ${repositoryUri}`,
        );
        execSync(`docker push ${repositoryUri}`);
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
      WHERE private_repository_id = (select id from repository where repository_name = '${repositoryName}' and region = '${nonDefaultRegion}');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
      },
    ),
  );

  // todo: force error and the delete image

  it('starts a transaction', begin());

  it(
    'adds a new repository policy',
    query(
      `
    INSERT INTO repository_policy (repository_id, policy_text, region)
    VALUES ((select id from repository where repository_name = '${repositoryName}'), '${policyMock}', '${nonDefaultRegion}');
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
    WHERE repository_id = (select id from repository where repository_name = '${repositoryName}') and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('should fail trying to move a repository with its images to a different region', () => {
    try {
      query(
        `
      with updated_repository_policy as (
        UPDATE repository_policy
        SET region = '${region}'
        WHERE repository_id = (select id from repository where repository_name = '${repositoryName}')
      ),
      updated_repository_image as (
        UPDATE repository_image
        SET private_repository_region = '${region}'
        WHERE private_repository_id = (select id from repository where repository_name = '${repositoryName}')
      )
      UPDATE repository
      SET region = '${region}'
      WHERE repository_name = '${repositoryName}' and region = '${nonDefaultRegion}';
  `,
        undefined,
        true,
        () => ({ username, password }),
      );
    } catch (e: any) {
      expect(e.message).toContain('Region cannot be modified');
    }
  });

  it('starts a transaction', begin());

  it(
    'removes the repository images',
    query(
      `
      DELETE FROM repository_image
      WHERE private_repository_id = (select id from repository where repository_name = '${repositoryName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the deletion', commit());

  it('starts a transaction', begin());

  it(
    'changes the region the repository is located in',
    query(
      `
      with updated_repository_policy as (
        UPDATE repository_policy
        SET region = '${region}'
        WHERE repository_id = (select id from repository where repository_name = '${repositoryName}')
      )
      UPDATE repository
      SET region = '${region}'
      WHERE repository_name = '${repositoryName}' and region = '${nonDefaultRegion}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check old repository region',
    query(
      `
      SELECT *
      FROM repository
      WHERE repository_name = '${repositoryName}' and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check new repository region',
    query(
      `
      SELECT *
      FROM repository
      WHERE repository_name = '${repositoryName}' and region = '${region}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check old repository policy region',
    query(
      `
    SELECT *
    FROM repository_policy
    WHERE repository_id = (select id from repository where repository_name = '${repositoryName}') and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check new repository policy region',
    query(
      `
    SELECT *
    FROM repository_policy
    WHERE repository_id = (select id from repository where repository_name = '${repositoryName}') and region = '${region}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the replacement', commit());

  it(
    'checks the repository was moved',
    query(
      `
      SELECT *
      FROM repository
      WHERE repository_name = '${repositoryName}' and region = '${region}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check new repository policy region',
    query(
      `
      SELECT *
      FROM repository_policy
      WHERE repository_id = (select id from repository where repository_name = '${repositoryName}') and region = '${region}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'removes the repository',
    query(
      `
      BEGIN;
        DELETE FROM repository_policy
        WHERE repository_id = (select id from repository where repository_name = '${repositoryName}' and region = '${region}');

        DELETE FROM repository
        WHERE repository_name = '${repositoryName}' and region = '${region}';
      COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the removal', commit());

  it(
    'checks the remaining table count for the last time',
    query(
      `
    SELECT *
    FROM repository_policy
    WHERE repository_id = (select id from repository where repository_name = '${repositoryName}' and region = '${region}');
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'checks the remaining table count for the last time',
    query(
      `
    SELECT *
    FROM repository
    WHERE repository_name = '${repositoryName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
