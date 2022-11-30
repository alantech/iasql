import * as iasql from '../../src/services/iasql';
import { runQuery, finish, execComposeUp, execComposeDown, runInstall, runBegin } from '../helpers';

const dbAlias = 'totalfailure';
const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const applyModules = ['aws_ec2', 'aws_security_group', 'aws_vpc'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Testing failure path', () => {
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

  // Fail on install
  it('fails to install fake module', done => {
    query(`
      select * from iasql_install('aws_fake');
    `)((_e?: any) => done()); // Ignore failure
  });

  it(
    'check install error',
    query(
      `
    SELECT *
    FROM iasql_rpc
    ORDER BY end_date DESC
    LIMIT 1;
  `,
      (row: any[]) => {
        expect(row.length).toBe(1);
        expect(row[0].method_name).toBe('iasqlInstall');
        expect(JSON.parse(row[0].err)).toHaveProperty('message');
      },
    ),
  );

  // Fail on uninstall
  it('fails to uninstall fake module', done => {
    query(`
      select * from iasql_uninstall('aws_fake');
    `)((_e?: any) => done()); // Ignore failure
  });

  it(
    'check uninstall error',
    query(
      `
    SELECT *
    FROM iasql_rpc
    ORDER BY end_date DESC
    LIMIT 1;
  `,
      (row: any[]) => {
        expect(row.length).toBe(1);
        expect(row[0].method_name).toBe('iasqlUninstall');
        expect(JSON.parse(row[0].err)).toHaveProperty('message');
      },
    ),
  );

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

  it('installs the ec2 module (and others needed)', install(applyModules));

  // Fails on attempted uninstall of the 'aws_account'
  it('fails to uninstall `aws_account`', done => {
    query(`
      SELECT * FROM iasql_uninstall('aws_account');
    `)((e: any) => {
      if (!e) return done(new Error('Somehow did not fail to uninstall `aws_account`'));
      return done();
    });
  });

  // Fail on apply
  it('starts a transaction', begin());

  it(
    'insert a new instance with wrong values',
    query(
      `
    BEGIN;
      INSERT INTO instance (ami, instance_type, tags)
        VALUES ('fake', 't2.micro', '{"name":"i-1"}');
      INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
        (SELECT id FROM instance WHERE tags ->> 'name' = 'i-1'),
        (SELECT id FROM security_group WHERE group_name='default' AND region='us-west-2');

      INSERT INTO instance (ami, instance_type, tags)
        VALUES ('ami-0892d3c7ee96c0bf7', 't2.micr', '{"name":"i-2"}');
      INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
        (SELECT id FROM instance WHERE tags ->> 'name' = 'i-2'),
        (SELECT id FROM security_group WHERE group_name='default' AND region='us-west-2');
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check number of instances',
    query(
      `
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = 'i-1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('fails to commit and restore', done => {
    query(`
      select * from iasql_commit();
    `)((_e?: any) => done()); // Ignore failure
  });

  it(
    'check apply error',
    query(
      `
    SELECT *
    FROM iasql_rpc
    ORDER BY end_date DESC
    LIMIT 1;
  `,
      (row: any[]) => {
        expect(row.length).toBe(1);
        expect(row[0].module_name).toBe('iasql_functions');
        expect(row[0].method_name).toBe('iasqlCommit');
      },
    ),
  );

  // Fail on upgrade
  /* it('fails to upgrade database (as it is up-to-date already)', done => {
    query(`
      select * from iasql_upgrade();
    `)((_e?: any) => done()); // Ignore failure
  });

  it(
    'check upgrade message',
    query(
      `
    SELECT *
    FROM iasql_rpc
    ORDER BY end_date DESC
    LIMIT 1;
  `,
      (row: any[]) => {
        expect(row.length).toBe(1);
        expect(row[0].method_name).toBe('iasqlUpgrade');
        expect(row[0].output.length).toBeGreaterThan(0);
      },
    ),
  ); */ // TODO: Revive upgrade check when upgrading is revived

  // TODO: how to test list, plan_apply, plan_sync, sync??

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
