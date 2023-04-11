import { EC2 } from '@aws-sdk/client-ec2';

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
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const modules = ['aws_security_group', 'aws_rds', 'aws_vpc'];

const ec2client = new EC2({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  region,
});

const getAvailabilityZones = async () => {
  return await ec2client.describeAvailabilityZones({
    Filters: [
      {
        Name: 'region-name',
        Values: [region],
      },
    ],
  });
};

let username: string, password: string;
let availabilityZone: string;

jest.setTimeout(960000);
beforeAll(async () => {
  const availabilityZones =
    (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone = availabilityZones.pop() ?? '';
  await execComposeUp();
});
afterAll(async () => await execComposeDown());

describe('RDS Integration Testing', () => {
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

  it('starts a transaction', begin());

  it(
    'creates an RDS instance',
    query(
      `
    BEGIN;
      INSERT INTO rds (db_instance_identifier, allocated_storage, db_instance_class, master_username, master_user_password, availability_zone, engine, engine_version, backup_retention_period, tags)
        VALUES ('${prefix}test', 20, 'db.t3.micro', 'test', 'testpass2023', (SELECT name FROM availability_zone WHERE region = '${region}' LIMIT 1), 'postgres', '13.4', 0, '{"name":"${prefix}-1"}');
      INSERT INTO rds_security_groups (rds_id, security_group_id) SELECT
        (SELECT id FROM rds WHERE db_instance_identifier='${prefix}test'),
        (SELECT id FROM security_group WHERE group_name='default' AND region = '${region}');
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'check adds a new db',
    query(
      `
    SELECT *
    FROM rds
    WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check adds a new db',
    query(
      `
    SELECT *
    FROM rds_security_groups
    INNER JOIN rds ON rds.id = rds_security_groups.rds_id
    WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'creates an RDS instance',
    query(
      `
    BEGIN;
      INSERT INTO rds (db_instance_identifier, allocated_storage, db_instance_class, master_username, master_user_password, availability_zone, engine, engine_version, backup_retention_period, tags)
        VALUES ('${prefix}test', 20, 'db.t3.micro', 'test', 'testpass2023', (SELECT name FROM availability_zone WHERE region = '${region}' LIMIT 1), 'postgres', '13.4', 0, '{"name":"${prefix}-1"}');
      INSERT INTO rds_security_groups (rds_id, security_group_id) SELECT
        (SELECT id FROM rds WHERE db_instance_identifier='${prefix}test'),
        (SELECT id FROM security_group WHERE group_name='default' AND region = '${region}');
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check adds a new db instance',
    query(
      `
    SELECT *
    FROM rds
    WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  itDocs(
    'check security group relationship',
    query(
      `
    SELECT *
    FROM rds_security_groups
    INNER JOIN rds ON rds.id = rds_security_groups.rds_id
    WHERE db_instance_identifier = '${prefix}test';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'changes the postgres version',
    query(
      `
    UPDATE rds SET engine_version = '13.5' WHERE tags ->> 'name' = '${prefix}-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it('starts a transaction', begin());

  itDocs(
    'updates RDS tags',
    query(
      `
    UPDATE rds SET tags = '{"name":"${prefix}-2"}' WHERE tags ->> 'name' = '${prefix}-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it('starts a transaction', begin());

  itDocs(
    'creates an RDS parameter group',
    query(
      `
    INSERT INTO parameter_group (name, family, description)
    VALUES ('${parameterGroupName}', '${engineFamily}', '${parameterGroupName} desc');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check parameter group insertion',
    query(
      `
    SELECT *
    FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check all modifiable boolean parameters are not true',
    query(
      `
    SELECT params ->> 'ParameterValue' as value
    FROM parameter_group, jsonb_array_elements(parameters) as params
    WHERE name = '${parameterGroupName}' AND params ->> 'DataType' = 'boolean' AND params ->> 'IsModifiable' = 'true';
  `,
      (res: any[]) => expect(res.every(r => r['value'] === '1')).toBeFalsy(),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'changes all boolean parameters for the new parameter group to be true',
    query(
      `
    WITH parameters AS (
      SELECT name, params
      FROM parameter_group,
          jsonb_array_elements(parameters) params
      WHERE name = '${parameterGroupName}' AND params ->> 'DataType' = 'boolean' AND params->> 'IsModifiable' = 'true'
    ), updated_parameters AS (
      select name, jsonb_set(params, '{ParameterValue}', '1', true) updated_params
      from parameters
    )
    UPDATE parameter_group
    SET parameters = (
      SELECT jsonb_agg(updated_params)
      FROM updated_parameters
      WHERE updated_parameters.name = parameter_group.name
    );
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  itDocs(
    'check all modifiable boolean parameters are true',
    query(
      `
    SELECT params ->> 'ParameterValue' as value
    FROM parameter_group, jsonb_array_elements(parameters) as params
    WHERE name = '${parameterGroupName}' AND params ->> 'DataType' = 'boolean' AND params ->> 'IsModifiable' = 'true';
  `,
      (res: any[]) => expect(res.every(r => r['value'] === '1')).toBeTruthy(),
    ),
  );

  it('uninstalls the rds module', uninstall(['aws_rds']));

  it('installs the rds module', install(['aws_rds']));

  it(
    'check instance count after uninstall',
    query(
      `
    SELECT *
    FROM rds
    WHERE tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check parameter group count after uninstall',
    query(
      `
    SELECT *
    FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'removes the RDS instance',
    query(
      `
    DELETE FROM rds
    WHERE tags ->> 'name' = '${prefix}-2';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'check rds delete count',
    query(
      `
    SELECT *
    FROM rds
    WHERE tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the change', commit());

  it(
    'check rds delete count',
    query(
      `
    SELECT *
    FROM rds
    WHERE tags ->> 'name' = '${prefix}-2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'removes the parameter group and it parameters',
    query(
      `
    DELETE FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'check parameter group count after delete',
    query(
      `
    SELECT *
    FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the change', commit());

  it(
    'check parameter group count after delete',
    query(
      `
    SELECT *
    FROM parameter_group
    WHERE name = '${parameterGroupName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  describe('Aurora instances not supported or messed with', () => {
    it('installs `aws_sdk` to create an aurora instance', query(`SELECT iasql_install('aws_sdk')`));

    it(
      'creates an aurora cluster',
      query(`
      SELECT invoke_rds(
        'createDBCluster',
        '{"Engine": "aurora", "AvailabilityZone": "${availabilityZone}", "DBClusterIdentifier": "${prefix}hidden", "MasterUserPassword": "dontcare", "MasterUsername": "dontcare"}',
        '${region}'
      );
    `),
    );

    it(
      'forces a "refresh" with an immediate transaction',
      query(`
      SELECT iasql_begin();
      SELECT iasql_commit();
    `),
    );

    it(
      'checks that the aurora instance is not present',
      query(
        `
      SELECT * FROM rds WHERE db_instance_identifier LIKE '${prefix}hidden%';
    `,
        (res: any[]) => expect(res.length).toBe(0),
      ),
    );

    it(
      'confirms that the aurora cluster actually exists',
      query(
        `
      SELECT invoke_rds(
        'describeDBClusters',
        '{"DBClusterIdentifier": "${prefix}hidden"}',
        '${region}'
      ) as result;
    `,
        (res: any[]) => expect(res.length).toBe(1),
      ),
    );

    it(
      'deletes the aurora instance',
      query(`
      SELECT invoke_rds('deleteDBCluster', '{"DBClusterIdentifier": "${prefix}hidden", "SkipFinalSnapshot": true}', '${region}');
    `),
    );

    it('uninstalls the `aws_sdk`', query(`SELECT iasql_uninstall('aws_sdk')`));
  });

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('RDS install/uninstall', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the RDS module', install(modules));

  it('uninstalls the RDS module', uninstall(modules));

  it('installs all modules', installAll());

  it('uninstalls the RDS module', uninstall(['aws_rds']));

  it('installs the RDS module', install(['aws_rds']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
