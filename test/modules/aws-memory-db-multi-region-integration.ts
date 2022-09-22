import * as iasql from '../../src/services/iasql';
import {
  getPrefix,
  runQuery,
  runApply,
  runInstall,
  runUninstall,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'memorydbtest';

const nonDefaultRegion = 'us-east-1';
const subnetGroupName = `${prefix}${dbAlias}sngregion`;
const clusterName = `${prefix}${dbAlias}clregion`;

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_memory_db', 'aws_acm_request'];

jest.setTimeout(1800000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('MemoryDB Multi-region Integration Testing', () => {
  it('creates a new test db', done =>
    void iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

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
    ),
  );

  it('syncs the regions', sync());

  it(
    'sets the default region',
    query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${process.env.AWS_REGION}';
  `),
  );

  it('installs the memory db module', install(modules));

  it(
    'creates a subnet group in a non-default region',
    query(`
    INSERT INTO subnet_group (subnet_group_name, region)
    VALUES ('${subnetGroupName}', '${nonDefaultRegion}');
  `),
  );

  it('undo changes', sync());

  it(
    'checks it has been removed',
    query(
      `
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'creates a subnet group in a non-default region',
    query(`
    INSERT INTO subnet_group (subnet_group_name, region)
    VALUES ('${subnetGroupName}', '${nonDefaultRegion}');
  `),
  );

  it('applies the change', apply());

  it(
    'checks the subnet group was added',
    query(
      `
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}' and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'creates a memory db cluster',
    query(`
    INSERT INTO memory_db_cluster (cluster_name, subnet_group)
    VALUES ('${clusterName}', '${subnetGroupName}');
  `),
  );

  it('applies the change', apply());

  it(
    'checks the memory db cluster was added',
    query(
      `
    SELECT *
    FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}' and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'changes the region the subnet group is located in',
    query(`
    WITH new_subnet_group AS (
      UPDATE subnet_group
      SET region = '${process.env.AWS_REGION}'
      WHERE subnet_group_name = '${subnetGroupName}';
    )
    UPDATE memory_db_cluster
    SET region = ${process.env.AWS_REGION}
    WHERE cluster_name = '${clusterName}';
  `),
  );

  it('applies the replacement', apply());

  it(
    'checks the subnet group was moved',
    query(
      `
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}' and region = '${process.env.AWS_REGION}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks the cluster was moved',
    query(
      `
    SELECT *
    FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}' and region = '${process.env.AWS_REGION}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'removes the cluster',
    query(`
    DELETE FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}';
  `),
  );

  it('applies the removal', apply());

  it(
    'checks the remaining cluster count',
    query(
      `
    SELECT *
    FROM memory_db_cluster
    WHERE cluster_name = '${clusterName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'removes the subnet group',
    query(`
    DELETE FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `),
  );

  it('applies the removal', apply());

  it(
    'checks the remaining table count for the last time',
    query(
      `
    SELECT *
    FROM subnet_group
    WHERE subnet_group_name = '${subnetGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
