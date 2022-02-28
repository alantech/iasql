import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, finish, execComposeUp, execComposeDown, } from '../helpers'

jest.setTimeout(960000);

beforeAll(execComposeUp);

afterAll(execComposeDown);

const prefix = getPrefix();
const dbAlias = 'rdstest';
const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);


describe('RDS Integration Testing SP', () => {
  it('creates a new test db elb', (done) => void iasql.add(
    dbAlias,
    'us-west-2',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the rds module', (done) => void iasql.install(
    ['aws_security_group@0.0.1', 'aws_rds@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('creates an RDS instance', query(`
    CALL create_or_update_rds('${prefix}test', 20, 'db.t3.micro', 'postgres', '13.4', 'test', 'testpass', 'us-west-2b', array['default']);
  `));

  it('applies the change', apply);

  it('changes the postgres version', query(`
    CALL create_or_update_rds('${prefix}test', 20, 'db.t3.micro', 'postgres', '13.5', 'test', 'testpass', 'us-west-2b', array['default']);
  `));

  it('applies the change', apply);

  it('removes the RDS instance', query(`
    CALL delete_rds('${prefix}test');
  `));

  it('applies the change', apply);

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});