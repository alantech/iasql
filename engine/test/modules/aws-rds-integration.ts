import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, finish, execComposeUp, execComposeDown, } from '../helpers'

jest.setTimeout(960000);

beforeAll(execComposeUp);

afterAll(execComposeDown);

const prefix = getPrefix();
const dbAlias = 'rdstest';
const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);


describe('RDS Integration Testing', () => {
  it('creates a new test db elb', (done) => void iasql.add(
    dbAlias,
    'us-west-2',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the rds module', (done) => void iasql.install(
    ['aws_security_group', 'aws_rds'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('creates an RDS instance', query(`
    CALL create_rds('${prefix}test', 50, 'db.t3.medium', 'postgres', '13.4', 'test', 'testpass', 'us-west-2b', array['default']);
  `));

  it('applies the change', apply);

  it('changes the postgres version', query(`
    WITH ver AS (
      SELECT id
      FROM engine_version
      WHERE engine = 'postgres'
      AND engine_version = '13.5'
      LIMIT 1
    )
    UPDATE rds
    SET engine_version_id = ver.id
    FROM ver
    WHERE db_instance_identifier = '${prefix}test';
  `));

  it('applies the change', apply);

  it('removes the RDS instance', query(`
    DELETE FROM rds WHERE db_instance_identifier = '${prefix}test';
  `));

  it('applies the change', apply);

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});