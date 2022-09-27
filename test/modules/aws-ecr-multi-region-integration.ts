import { execSync } from 'child_process';

import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  getPrefix,
  runQuery,
  runInstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'ecrtest';
const repositoryName = `${prefix}${dbAlias}`;
const nonDefaultRegion = 'us-east-1';
const policyMock =
  '{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer" ] } ]}';

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_ecr'];
const dockerImage = 'public.ecr.aws/docker/library/hello-world:latest';
const repositoryTag = 'v1';

jest.setTimeout(240000);
beforeAll(async () => {
  // pull sample image
  execSync(
    `docker login --username AWS -p $(aws ecr-public get-login-password --region ${nonDefaultRegion}) public.ecr.aws`,
  );
  execSync(`docker pull ${dockerImage}`);

  await execComposeUp();
});
afterAll(async () => await execComposeDown());

describe('ECR Multi-region Integration Testing', () => {
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

  it('installs the ECR module', install(modules));

  it(
    'adds a new repository',
    query(`  
    INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability, region)
      VALUES ('${repositoryName}', false, 'MUTABLE', '${nonDefaultRegion}');
  `),
  );

  it('undo changes', sync());

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

  it(
    'adds a new repository',
    query(`  
    INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability, region)
      VALUES ('${repositoryName}', false, 'MUTABLE', '${nonDefaultRegion}');
  `),
  );

  it('applies the change', apply());

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
    query(`SELECT repository_uri FROM repository WHERE repository_name='${repositoryName}' and region = '${nonDefaultRegion}'`, (res: any[]) => {
      // get repository uri to retag and pull
      const repositoryUri = res[0]['repository_uri'];
      execSync(`docker tag ${dockerImage} ${repositoryUri}`);
      execSync(
        `docker login --username AWS -p $(aws ecr get-login-password --region ${nonDefaultRegion}) ${repositoryUri}`,
      );

      execSync(`docker push ${repositoryUri}`);

      // upload with a new tag
      execSync(`docker tag ${dockerImage} ${repositoryUri}:${repositoryTag}`);
      execSync(`docker push ${repositoryUri}:${repositoryTag}`);
    }),
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
    'adds a new repository policy',
    query(`
    INSERT INTO repository_policy (repository_name, policy_text, region)
    VALUES ('${repositoryName}', '${policyMock}', '${nonDefaultRegion}');
  `),
  );

  it('applies the change', apply());

  it(
    'check adds a new repository policy',
    query(
      `
    SELECT *
    FROM repository_policy
    WHERE repository_name = '${repositoryName}' and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'changes the region the repository is located in',
    query(`
      with updated_repository_policy as (
        UPDATE repository_policy
          SET region = '${process.env.AWS_REGION}'
          WHERE repository_name = '${repositoryName}'
      ),
      udpated_repository_image as (
        UPDATE repository_image
        SET private_repository_region = '${process.env.AWS_REGION}'
        WHERE private_repository = '${repositoryName}'
      )
      UPDATE repository
      SET region = '${process.env.AWS_REGION}'
      WHERE repository_name = '${repositoryName}';
  `),
  );

  it(
    'check new repository region',
    query(
      `
    SELECT *
    FROM repository
    WHERE repository_name = '${repositoryName}' and region = '${process.env.AWS_REGION}';
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
    WHERE repository_name = '${repositoryName}' and region = '${process.env.AWS_REGION}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check new repository image region',
    query(
      `
    SELECT *
    FROM repository_image
    WHERE private_repository = '${repositoryName}' and private_repository_region = '${process.env.AWS_REGION}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('applies the replacement', apply());

  it(
    'checks the repository was moved',
    query(
      `
      SELECT *
      FROM repository
      WHERE repository_name = '${repositoryName}' and region = '${process.env.AWS_REGION}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'removes the repository',
    query(`
    BEGIN;
      DELETE FROM repository_image
      WHERE private_repository = '${repositoryName}';

      DELETE FROM repository_policy
      WHERE repository_name = '${repositoryName}';

      DELETE FROM repository
      WHERE repository_name = '${repositoryName}';
    COMMIT;
  `),
  );

  it('applies the removal', apply());

  it(
    'checks the remaining table count for the last time',
    query(
      `
    SELECT *
    FROM repository_image
    WHERE private_repository = '${repositoryName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'checks the remaining table count for the last time',
    query(
      `
    SELECT *
    FROM repository_policy
    WHERE repository_name = '${repositoryName}';
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
