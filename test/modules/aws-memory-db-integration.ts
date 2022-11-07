import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runCommit,
  runInstall,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers'

const prefix = getPrefix();
const dbAlias = 'memorydbtest';

const subnetGroupName = `${prefix}${dbAlias}sng`;
const clusterName = `${prefix}${dbAlias}cl`;

const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
// MemoryDB has a *very* constrained set of regions
const region = defaultRegion([
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ca-central-1',
  'eu-central-1',
  'eu-north-1',
  'eu-west-1',
  'eu-west-2',
  'sa-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
]);
const modules = ['aws_memory_db', 'aws_acm'];

jest.setTimeout(1800000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('MemoryDB Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', commit());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `));

  it('installs the memory db module', install(modules));

  it ('creates a subnet group', query(`
    INSERT INTO subnet_group (subnet_group_name)
    VALUES ('${subnetGroupName}');
  `));

  it('undo changes', rollback());

  it('checks it has been removed', query(`
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it ('creates a subnet group', query(`
    INSERT INTO subnet_group (subnet_group_name)
    VALUES ('${subnetGroupName}');
  `));

  it('applies the change', commit());

  it('checks the subnet group was added', query(`
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('changes the subnet group description', query(`
    UPDATE subnet_group
    SET description = 'Short desc'
    WHERE subnet_group_name = '${subnetGroupName}';
  `));

  it('applies the change', commit());

  it ('creates a memory db cluster', query(`
    INSERT INTO memory_db_cluster (cluster_name, subnet_group_id)
    VALUES ('${clusterName}', (select id from subnet_group where subnet_group_name = '${subnetGroupName}'));

    INSERT INTO memory_db_cluster_security_groups (security_group_id, memory_db_cluster_id, region)
    VALUES ((select id from security_group where group_name = 'default' and region = '${region}'), (select id from memory_db_cluster where cluster_name = '${clusterName}'), '${region}');
  `));

  it('undo changes', rollback());

  it('checks it has been removed', query(`
    SELECT *
    FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it ('creates a memory db cluster', query(`
    INSERT INTO memory_db_cluster (cluster_name, subnet_group_id)
    VALUES ('${clusterName}', (select id from subnet_group where subnet_group_name = '${subnetGroupName}'));

    INSERT INTO memory_db_cluster_security_groups (security_group_id, memory_db_cluster_id, region)
    VALUES ((select id from security_group where group_name = 'default' and region = '${region}'), (select id from memory_db_cluster where cluster_name = '${clusterName}'), '${region}');
  `));

  it('applies the change', commit());

  it('checks the memory db cluster was added', query(`
    SELECT *
    FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('changes the cluster description', query(`
    UPDATE memory_db_cluster
    SET description = 'Short desc'
    WHERE cluster_name = '${clusterName}';
  `));

  it('applies the change', commit());

  it('changes the cluster arn', query(`
    UPDATE memory_db_cluster
    SET arn = 'fake-arn'
    WHERE cluster_name = '${clusterName}';
  `));

  it('applies the change', commit());

  it('uninstalls the module', uninstall(modules));

  it('installs the module', install(modules));

  it('check memory db cluster count after uninstall', query(`
    SELECT *
    FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('removes the memory db cluster', query(`
    DELETE FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}';
  `));

  it('checks the remaining memory db cluster count', query(`
    SELECT *
    FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the change', commit());

  it('checks the remaining memory db cluster count again', query(`
    SELECT *
    FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check subnet group count after uninstall', query(`
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('removes the subnet group', query(`
    DELETE FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `));

  it('checks the remaining subnet group count', query(`
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the change', commit());

  it('checks the remaining subnet group count again', query(`
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
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', commit());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `));

  it('installs the module', install(modules));

  it('uninstalls the module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the module', uninstall(['aws_memory_db']));

  it('installs the module', install(['aws_memory_db']));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
