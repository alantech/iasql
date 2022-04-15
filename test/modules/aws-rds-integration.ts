import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, runInstall, runUninstall, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'rdstest';
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const availabilityZone = `${process.env.AWS_REGION ?? 'barf'}a`;
const modules = ['aws_security_group', 'aws_rds', 'aws_vpc'];

jest.setTimeout(960000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('RDS Integration Testing', () => {
  it('creates a new test db elb', (done) => void iasql.connect(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the rds module', install(modules));

  it('creates an RDS instance', query(`
    BEGIN;
      INSERT INTO rds (db_instance_identifier, allocated_storage, db_instance_class, master_username, master_user_password, availability_zone, engine, backup_retention_period)
        VALUES ('${prefix}test', 20, 'db.t3.micro', 'test', 'testpass', '${availabilityZone}', 'postgres:13.4', 0);
      INSERT INTO rds_security_groups (rds_id, security_group_id) SELECT
        (SELECT id FROM rds WHERE db_instance_identifier='${prefix}test'),
        (SELECT id FROM security_group WHERE group_name='default');
    COMMIT;
  `));

  it('undo changes', sync());

  it('check adds a new repository', query(`
    SELECT *
    FROM rds
    WHERE db_instance_identifier = '${prefix}test';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check adds a new repository', query(`
    SELECT *
    FROM rds_security_groups
    INNER JOIN rds ON rds.id = rds_security_groups.rds_id
    WHERE db_instance_identifier = '${prefix}test';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('creates an RDS instance', query(`
    BEGIN;
      INSERT INTO rds (db_instance_identifier, allocated_storage, db_instance_class, master_username, master_user_password, availability_zone, engine, backup_retention_period)
        VALUES ('${prefix}test', 20, 'db.t3.micro', 'test', 'testpass', '${availabilityZone}', 'postgres:13.4', 0);
      INSERT INTO rds_security_groups (rds_id, security_group_id) SELECT
        (SELECT id FROM rds WHERE db_instance_identifier='${prefix}test'),
        (SELECT id FROM security_group WHERE group_name='default');
    COMMIT;
  `));

  it('applies the change', apply());

  it('check adds a new repository', query(`
    SELECT *
    FROM rds
    WHERE db_instance_identifier = '${prefix}test';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check adds a new repository', query(`
    SELECT *
    FROM rds_security_groups
    INNER JOIN rds ON rds.id = rds_security_groups.rds_id
    WHERE db_instance_identifier = '${prefix}test';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('changes the postgres version', query(`
    UPDATE rds SET engine = 'postgres:13.5' WHERE db_instance_identifier = '${prefix}test';
  `));

  it('applies the change', apply());

  it('uninstalls the rds module', uninstall(
    ['aws_rds']));

  it('installs the rds module', install(
    ['aws_rds']));

  it('removes the RDS instance', query(`
    DELETE FROM rds;
  `));

  it('applies the change', apply());

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('RDS install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'us-east-1', // Share region with common tests
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the RDS module', install(
    modules));

  it('uninstalls the RDS module', uninstall(
    modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.dbUser,
    true).then(...finish(done)));

  it('uninstalls the RDS module', uninstall(
    ['aws_rds']));

  it('installs the RDS module', install(
    ['aws_rds']));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
