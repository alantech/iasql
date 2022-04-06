import * as iasql from '../../src/services/iasql'
import { runQuery, finish, execComposeUp, execComposeDown, runInstall } from '../helpers'

const dbAlias = 'totalfailure';
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const applyModules = ['aws_ec2', 'aws_security_group']

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown([...applyModules]));

describe('Testing failure path', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  // Fail on install
  it('fails to install fake module', (done) => {
    query(`
      select * from iasql_install('aws_fake');
    `)((_e?: any) => done());  // Ignore failure
  });

  it('check install error', query(`
    SELECT *
    FROM iasql_operation
    ORDER BY end_date DESC
    LIMIT 1;
  `, (row: any[]) => {
    expect(row.length).toBe(1);
    expect(row[0].optype).toBe('INSTALL');
    expect(JSON.parse(row[0].err)).toHaveProperty('message');
  }));

  // Fail on uninstall
  it('fails to uninstall fake module', (done) => {
    query(`
      select * from iasql_uninstall('aws_fake');
    `)((_e?: any) => done());  // Ignore failure
  });

  it('check uninstall error', query(`
    SELECT *
    FROM iasql_operation
    ORDER BY end_date DESC
    LIMIT 1;
  `, (row: any[]) => {
    expect(row.length).toBe(1);
    expect(row[0].optype).toBe('UNINSTALL');
    expect(JSON.parse(row[0].err)).toHaveProperty('message');
  }));

  // Fail on apply
  it('installs the ec2 module', install(applyModules));

  it('insert a new instance with wrong values', query(`
    INSERT INTO instance (name, ami, instance_type)
      VALUES ('i-1','fake', 't2.micro');
    INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
      (SELECT id FROM instance WHERE name='i-1'),
      (SELECT id FROM security_group WHERE group_name='default');
  `));

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE name = ANY(array['i-1']);
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('fails to apply', (done) => {
    query(`
      select * from iasql_apply();
    `)((_e?: any) => done());  // Ignore failure
  });

  it('check apply error', query(`
    SELECT *
    FROM iasql_operation
    ORDER BY end_date DESC
    LIMIT 1;
  `, (row: any[]) => {
    expect(row.length).toBe(1);
    expect(row[0].optype).toBe('APPLY');
    expect(JSON.parse(row[0].err)).toHaveProperty('message')
  }));

  // Fail on upgrade
  it('fails to upgrade module',  (done) => {
    query(`
      select * from iasql_upgrade();
    `)((_e?: any) => done());  // Ignore failure
  });

  it('check upgrade error', query(`
    SELECT *
    FROM iasql_operation
    ORDER BY end_date DESC
    LIMIT 1;
  `, (row: any[]) => {
    expect(row.length).toBe(1);
    expect(row[0].optype).toBe('UPGRADE');
    expect(JSON.parse(row[0].err)).toHaveProperty('message');
  }));

  // TODO: how to test list, plan_apply, plan_sync, sync??

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

