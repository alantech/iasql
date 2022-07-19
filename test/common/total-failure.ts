import * as iasql from '../../src/services/iasql'
import { runQuery, finish, execComposeUp, execComposeDown, runInstall } from '../helpers'

const dbAlias = 'totalfailure';
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const applyModules = ['aws_ec2', 'aws_security_group', 'aws_vpc']

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Testing failure path', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  // Fail on install
  it('fails to install fake module', (done) =>
    query(`
      select * from iasql_install('aws_fake');
    `, (e: any) => {
      console.log(e)
      console.log(JSON.stringify(e))
      expect(true).toBeFalsy();
      done();
      return;
    })
  );

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

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  // Fail on apply
  it('installs the ec2 module (and others needed)', install(applyModules));

  it('insert a new instance with wrong values', query(`
    BEGIN;
      INSERT INTO instance (ami, instance_type, tags)
        VALUES ('fake', 't2.micro', '{"name":"i-1"}');
      INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
        (SELECT id FROM instance WHERE tags ->> 'name' = 'i-1'),
        (SELECT id FROM security_group WHERE group_name='default');

      INSERT INTO instance (ami, instance_type, tags)
        VALUES ('ami-0892d3c7ee96c0bf7', 't2.micr', '{"name":"i-2"}');
      INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
        (SELECT id FROM instance WHERE tags ->> 'name' = 'i-2'),
        (SELECT id FROM security_group WHERE group_name='default');
    COMMIT;
  `));

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = 'i-1';
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
  it('fails to upgrade database (as it is up-to-date already)',  (done) => {
    query(`
      select * from iasql_upgrade();
    `)((_e?: any) => done());  // Ignore failure
  });

  it('check upgrade message', query(`
    SELECT *
    FROM iasql_operation
    ORDER BY end_date DESC
    LIMIT 1;
  `, (row: any[]) => {
    expect(row.length).toBe(1);
    expect(row[0].optype).toBe('UPGRADE');
    expect(row[0].output.length).toBeGreaterThan(0);
  }));

  // TODO: how to test list, plan_apply, plan_sync, sync??

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

