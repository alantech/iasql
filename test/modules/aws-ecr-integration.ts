import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, finish, execComposeUp, execComposeDown, getRandomRegion, } from '../helpers'

jest.setTimeout(240000);

beforeAll(execComposeUp);

afterAll(execComposeDown);

const prefix = getPrefix();
const dbAlias = 'ecrtest';
const repositoryName = prefix + dbAlias;
const pubRepositoryName = 'public' + prefix + dbAlias;
const policyMock = '{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer" ] } ]}';
const updatePolicyMock = '{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage" ] } ]}';
const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);

describe('ECR Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    getRandomRegion(),
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the ecr module', (done) => void iasql.install(
    ['aws_ecr@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  describe('private repository', () => {
    it('adds a new repository', query(`
      INSERT INTO aws_repository (repository_name, scan_on_push, image_tag_mutability)
      VALUES ('${repositoryName}', false, 'MUTABLE');
    `));
  
    it('applies the reporsitory change', apply);

    it('check adds a new repository', query(`
      SELECT *
      FROM aws_repository
      WHERE repository_name = '${repositoryName}';
    `, (res: any[]) => {
      expect(res.length).toBe(1);
      expect(res[0]['scan_on_push']).toBe(false);
      return expect(res[0]['image_tag_mutability']).toBe('MUTABLE');
    }));
  
    it('tries to update a repository autogenerated field', query(`
      UPDATE aws_repository SET repository_arn = '${repositoryName}arn' WHERE repository_name = '${repositoryName}';
    `));

    it('applies change which will undo it', apply);

    it('tries to update a repository field', query(`
      UPDATE aws_repository SET scan_on_push = true WHERE repository_name = '${repositoryName}';
    `));
  
    it('applies the change', apply);

    it('check adds a new repository', query(`
      SELECT *
      FROM aws_repository
      WHERE repository_name = '${repositoryName}';
    `, (res: any[]) => {
      expect(res.length).toBe(1);
      return expect(res[0]['scan_on_push']).toBe(true);
    }));
  
    it('adds a new repository policy', query(`
      INSERT INTO aws_repository_policy (repository_id, policy_text)
      SELECT id, '${policyMock}'
      FROM aws_repository
      WHERE repository_name = '${repositoryName}';
    `));
  
    it('applies the change', apply);

    it('check adds a new repository policy', query(`
      SELECT *
      FROM aws_repository_policy
      INNER JOIN aws_repository ON aws_repository.id = aws_repository_policy.repository_id
      WHERE repository_name = '${repositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('tries to update a repository policy autogenerated field', query(`
      UPDATE aws_repository_policy AS arp
      SET registry_id = '${repositoryName}registry'
      FROM aws_repository AS ar
      WHERE ar.repository_name = '${repositoryName}' AND ar.id = arp.repository_id;
    `));

    it('applies change which will undo it', apply);

    it('tries to update a repository field', query(`
      UPDATE aws_repository_policy AS arp
      SET policy_text = '${updatePolicyMock}'
      FROM aws_repository AS ar
      WHERE ar.repository_name = '${repositoryName}' AND ar.id = arp.repository_id;
    `));
  
    it('applies the change', apply);

    it('deletes the repository policy', query(`
      DELETE FROM aws_repository_policy AS arp
      USING aws_repository AS ar
      WHERE ar.repository_name = '${repositoryName}' AND ar.id = arp.repository_id;
    `));

    it('applies the delete repository policy', apply);

    it('check deletes the repository policy', query(`
      SELECT *
      FROM aws_repository_policy
      INNER JOIN aws_repository ON aws_repository.id = aws_repository_policy.repository_id
      WHERE repository_name = '${repositoryName}';
    `, (res: any[]) => expect(res.length).toBe(0)));

    it('deletes the repository', query(`
      DELETE FROM aws_repository
      WHERE repository_name = '${repositoryName}';
    `));

    it('applies deletes the repository', apply);

    it('check deletes the repository', query(`
      SELECT scan_on_push, image_tag_mutability
      FROM aws_repository
      WHERE repository_name = '${repositoryName}';
    `, (res: any[]) => expect(res.length).toBe(0)));
  });

  describe('public repository', () => {
    it('adds a new public repository', query(`
      INSERT INTO aws_public_repository (repository_name)
      VALUES ('${pubRepositoryName}');
    `));
  
    it('applies the public repository change', apply);

    it('check adds a new public repository', query(`
      SELECT *
      FROM aws_public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('tries to update a public repository autogenerated field', query(`
      UPDATE aws_public_repository SET repository_arn = '${pubRepositoryName}arn' WHERE repository_name = '${pubRepositoryName}';
    `));

    it('applies change which will undo it', apply);

    it('check update public repository (noop)', query(`
      SELECT *
      FROM aws_public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));
  
    it('deletes the public repository', query(`
      DELETE FROM aws_public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `));

    it('applies the log group change (last time)', apply);

    it('check deletes the public repository', query(`
      SELECT *
      FROM aws_public_repository
      WHERE repository_name = '${pubRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(0)));
  });

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
