import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, runInstall, runUninstall, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'memorydbtest';

const subnetGroupName = `${prefix}${dbAlias}sng`;
const clusterName = `${prefix}${dbAlias}cl`;

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_memory_db'];

jest.setTimeout(960000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('MemoryDB Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the memory db module', install(modules));

  it ('creates a subnet group', query(`
    INSERT INTO subnet_group (subnet_group_name)
    VALUES ('${subnetGroupName}');
  `));

  it('undo changes', sync());

  it('checks it has been removed', query(`
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it ('creates a subnet group', query(`
    INSERT INTO subnet_group (subnet_group_name)
    VALUES ('${subnetGroupName}');
  `));

  it('applies the change', apply());

  it('checks the table was added', query(`
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('changes the column definition', query(`
    UPDATE subnet_group
    SET description = 'Short desc'
    WHERE subnet_group_name = '${subnetGroupName}';
  `));

  it('applies the change', apply());

  it('uninstalls the module', uninstall(modules));

  it('installs the module', install(modules));

  it('check table count after uninstall', query(`
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('removes the dynamo table', query(`
    DELETE FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `));

  it('checks the remaining table count', query(`
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the change', apply());

  it('checks the remaining table count again', query(`
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('MemoryDB install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the module', install(modules));

  it('uninstalls the module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the Dynamo module', uninstall(modules));

  it('installs the Dynamo module', install(modules));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
