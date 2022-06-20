import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, runInstall, runUninstall, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'rdstest';
const parameterGroupName = `${prefix}${dbAlias}pg`;
const engineFamily = `postgres13`;

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
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

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

  it('creates an RDS parameter group', query(`
    INSERT INTO parameter_group (name, family, description)
    VALUES ('${parameterGroupName}', '${engineFamily}', '${parameterGroupName} desc');
  `));

  it('applies the change', apply());

  it('check parameter group insertion', query(`
    SELECT *
    FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check all modifiable boolean parameters are not true', query(`
    SELECT params ->> 'ParameterValue' as value
    FROM parameter_group, jsonb_array_elements(parameters) as params
    WHERE name = '${parameterGroupName}' AND params ->> 'DataType' = 'boolean' AND params ->> 'IsModifiable' = 'true';
  `, (res: any[]) => expect(res.every(r => r['value'] === '1')).toBeFalsy()));

  it('changes all boolean parameters for the new parameter group to be true', query(`
    WITH parameters AS (
      SELECT name, params
      FROM parameter_group,
          jsonb_array_elements(parameters) params
      WHERE name = '${parameterGroupName}' AND params ->> 'DataType' = 'boolean' AND params->> 'IsModifiable' = 'true'
    ), updated_parameters AS (
      select name, jsonb_set(params, '{ParameterValue}', '1', false) updated_params
      from parameters
    )
    UPDATE parameter_group
    SET parameters = (
      SELECT jsonb_agg(updated_params)
      FROM updated_parameters
      WHERE updated_parameters.name = parameter_group.name
    );
  `));

  it('applies the change', apply());

  it('check all modifiable boolean parameters are true', query(`
    SELECT params ->> 'ParameterValue' as value
    FROM parameter_group, jsonb_array_elements(parameters) as params
    WHERE name = '${parameterGroupName}' AND params ->> 'DataType' = 'boolean' AND params ->> 'IsModifiable' = 'true';
  `, (res: any[]) => expect(res.every(r => r['value'] === '1')).toBeTruthy()));

  it('uninstalls the rds module', uninstall(
    ['aws_rds']));

  it('installs the rds module', install(
    ['aws_rds']));

  it('check instance count after uninstall', query(`
    SELECT *
    FROM rds
    WHERE db_instance_identifier = '${prefix}test';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check parameter group count after uninstall', query(`
    SELECT *
    FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('removes the RDS instance', query(`
    DELETE FROM rds
    WHERE db_instance_identifier = '${prefix}test';
  `));

  it('check rds delete count', query(`
    SELECT *
    FROM rds
    WHERE db_instance_identifier = '${prefix}test';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the change', apply());

  it('check rds delete count', query(`
    SELECT *
    FROM rds
    WHERE db_instance_identifier = '${prefix}test';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('removes the parameter group and it parameters', query(`
    DELETE FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `));

  it('check parameter group count after delete', query(`
    SELECT *
    FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the change', apply());

  it('check parameter group count after delete', query(`
    SELECT *
    FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('RDS install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the RDS module', install(
    modules));

  it('uninstalls the RDS module', uninstall(
    modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the RDS module', uninstall(
    ['aws_rds']));

  it('installs the RDS module', install(
    ['aws_rds']));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
