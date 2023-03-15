import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  itDocs,
  runBegin,
  runCommit,
  runInstall,
  runInstallAll,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'rdstest';
const parameterGroupName = `${prefix}${dbAlias}pg`;
const engineFamily = `postgres13`;

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_security_group', 'aws_rds', 'aws_vpc'];

jest.setTimeout(1800000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('DB Cluster Integration Testing', () => {
  it('creates a new test db elb', done => {
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

  it('starts a transaction', begin());

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs('installs the rds module', install(modules));

  // cluster testing
  it('starts a transaction', begin());

  itDocs(
    'creates an RDS subnet group',
    query(
      `
    INSERT INTO db_subnet_group (name, description, subnets)
    VALUES ('${prefix}cluster-test', 'test subnet group', (select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true and vpc.region = '${region}' LIMIT 3)));
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the change', commit());

  itDocs(
    'check subnet group insertion',
    query(
      `
    SELECT *
    FROM db_subnet_group
    WHERE name = '${prefix}cluster-test';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'creates an RDS cluster',
    query(
      `
    BEGIN;
      INSERT INTO db_cluster (db_cluster_identifier, engine, allocated_storage, iops, db_cluster_instance_class, master_username, master_user_password, subnet_group_id) VALUES
        ('${prefix}cluster-test', 'mysql', 100, 1000, 'db.m6gd.xlarge', 'admin', 'admin123456', (select id FROM db_subnet_group WHERE name = '${prefix}cluster-test'));
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check adds a new db cluster',
    query(
      `
    SELECT *
    FROM db_cluster
    WHERE db_cluster_identifier = '${prefix}cluster-test';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'changes the mysql version',
    query(
      `
    UPDATE db_cluster SET engine_version = '8.0.32' WHERE db_cluster_identifier = '${prefix}cluster-test';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check that engine has been modified',
    query(
      `
    SELECT *
    FROM rds
    WHERE db_instance_identifier = '${prefix}cluster-test' AND engine_version = '8.0.32';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'removes the RDS cluster',
    query(
      `
    DELETE FROM db_cluster
    WHERE db_cluster_identifier = '${prefix}cluster-test';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check RDS cluster delete count',
    query(
      `
    SELECT *
    FROM db_cluster
    WHERE db_cluster_identifier = '${prefix}cluster-test';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'removes the db subnet group and its parameters',
    query(
      `
    DELETE FROM subnet_group
    WHERE name = '${prefix}cluster-test';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check subnet group count after delete',
    query(
      `
    SELECT *
    FROM db_subnet_group
    WHERE name = '${prefix}cluster-test';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
