import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const dbAlias = 'ec2test';
// specific to us-west-2, varies per region
const region = 'us-west-2'
const amznAmiId = 'ami-06cffe063efe892ad';
const ubuntuAmiId = 'ami-0892d3c7ee96c0bf7';

const prefix = getPrefix();
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const querySync = runQuery.bind(null, `${dbAlias}_sync`);
const install = runInstall.bind(null, dbAlias);
const installSync = runInstall.bind(null, `${dbAlias}_sync`);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_ec2', 'aws_security_group', 'aws_vpc'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('EC2 Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${region}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('creates a new test db to test sync', (done) => void iasql.connect(
    `${dbAlias}_sync`,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', installSync(['aws_account']));

  it('inserts aws credentials', querySync(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the ec2 module', install(modules));

  it('adds two ec2 instance', (done) => {
    query(`
      BEGIN;
        INSERT INTO instance (ami, instance_type, tags)
          VALUES ('${ubuntuAmiId}', 't2.micro', '{"name":"${prefix}-1"}');
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'),
          (SELECT id FROM security_group WHERE group_name='default');
      COMMIT;

      BEGIN;
        INSERT INTO instance (ami, instance_type, tags)
          VALUES ('${amznAmiId}', 't2.micro', '{"name":"${prefix}-2"}');
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2'),
          (SELECT id FROM security_group WHERE group_name='default');
      COMMIT;
    `)((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('Undo changes', sync());

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds two ec2 instance', (done) => {
    query(`
    BEGIN;
      INSERT INTO instance (ami, instance_type, tags)
        VALUES ('${ubuntuAmiId}', 't2.micro', '{"name":"${prefix}-1"}');
      INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
        (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-1'),
        (SELECT id FROM security_group WHERE group_name='default');
    COMMIT;

    BEGIN;
      INSERT INTO instance (ami, instance_type, tags)
        VALUES ('${amznAmiId}', 't2.micro', '{"name":"${prefix}-2"}');
      INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
        (SELECT id FROM instance WHERE tags ->> 'name' = '${prefix}-2'),
        (SELECT id FROM security_group WHERE group_name='default');
    COMMIT;
    `)((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('check number of instances', query(`
    SELECT *
    FROM instance
    WHERE tags ->> 'name' = '${prefix}-1' OR
    tags ->> 'name' = '${prefix}-2';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('applies the created instances', apply());

  it('syncs the changes from the first database to the second', runSync(`${dbAlias}_sync`));

  it('set both ec2 instances to the same ami', query(`
    UPDATE instance SET ami = '${amznAmiId}' WHERE tags ->> 'name' = '${prefix}-1';
  `));

  it('applies the instances change', apply());

  it('check number of instances', query(`
    SELECT *
    FROM instance;
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('check instance ami update', query(`
    SELECT *
    FROM instance
    WHERE ami = '${ubuntuAmiId}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  // TODO hibernation requires EBS to be encrypted
  // it('hibernate instance', query(`
  //   UPDATE instance SET state = 'hibernated' WHERE tags ->> 'name' = '${prefix}-1';
  // `));

  it('stop instance', query(`
    UPDATE instance SET state = 'stopped' WHERE tags ->> 'name' = '${prefix}-2';
  `));

  it('applies the instances change', apply());

  it('check number of stopped instances', query(`
    SELECT *
    FROM instance
    WHERE state = 'stopped';
  `, (res: any[]) => expect(res.length).toBe(1)));

  // it('check number of hibernated instances', query(`
  //   SELECT *
  //   FROM instance
  //   WHERE state = 'hibernated';
  // `, (res: any[]) => expect(res.length).toBe(1)));

  it('uninstalls the ec2 module', uninstall(modules));

  it('installs the ec2 module', install(modules));

  it('check number of instances', query(`
    SELECT *
    FROM instance;
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('deletes both ec2 instances', query(`
    DELETE FROM instance;
  `));

  it('applies the instances deletion', apply());

  it('check number of instances', query(`
    SELECT *
    FROM instance;
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));

  it('deletes the test sync db', (done) => void iasql
    .disconnect(`${dbAlias}_sync`, 'not-needed')
    .then(...finish(done)));
});

describe('EC2 install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  // Install can automatically pull in all dependencies, so we only need to specify ec2 here
  it('installs the ec2 module', install(['aws_ec2']));

  // But uninstall won't uninstall dependencies, so we need to specify that we want all three here
  it('uninstalls the ec2 module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstall ec2 using overloaded sp', query(`
    select iasql_uninstall('aws_ec2');
  `));

  it('install ec2 using overloaded sp', query(`
    select iasql_install('aws_ec2');
  `));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
