import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runBegin,
  runCommit,
  runInstall,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'vpctest';
const region = defaultRegion();
const nonDefaultRegion = 'us-east-1';
const nonDefaultRegionAvailabilityZone = 'us-east-1a';

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
// We have to install the `aws_security_group` to test fully the integration even though is not being used,
// since the `aws_vpc` module creates a `default` security group automatically.
const modules = ['aws_vpc', 'aws_security_group'];

const randIPBlock = Math.floor(Math.random() * 254) + 1; // 0 collides with the default CIDR block

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('VPC Multi-region Integration Testing', () => {
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

  it('installs the vpc module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new vpc',
    query(
      `  
    INSERT INTO vpc (cidr_block, region)
    VALUES ('192.${randIPBlock}.0.0/16', '${nonDefaultRegion}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a subnet',
    query(
      `
    INSERT INTO subnet (availability_zone, vpc_id, cidr_block, region)
    SELECT '${nonDefaultRegionAvailabilityZone}', id, '192.${randIPBlock}.0.0/16', '${nonDefaultRegion}'
    FROM vpc
    WHERE is_default = false
    AND cidr_block = '192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it('starts a transaction', begin());

  it(
    'adds a new vpc',
    query(
      `  
    INSERT INTO vpc (cidr_block, tags, region)
    VALUES ('192.${randIPBlock}.0.0/16', '{"name":"${prefix}-1"}', '${nonDefaultRegion}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a subnet',
    query(
      `
    INSERT INTO subnet (availability_zone, vpc_id, cidr_block, region)
    SELECT '${nonDefaultRegionAvailabilityZone}', id, '192.${randIPBlock}.0.0/16', '${nonDefaultRegion}'
    FROM vpc
    WHERE is_default = false
    AND cidr_block = '192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the vpc change', commit());

  it(
    'check vpc is available',
    query(
      `
  SELECT * FROM vpc 
  WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available' AND tags ->> 'name' = '${prefix}-1' AND region = '${nonDefaultRegion}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'updates vpc region',
    query(
      `
    DELETE FROM route_table_association WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-1');
    DELETE FROM route
    WHERE route_table_id = (
      SELECT id
      FROM route_table
      WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-1')
    );
    DELETE FROM route_table WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-1');
    DELETE FROM security_group_rule WHERE security_group_id = (SELECT id FROM security_group WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-1'));
    DELETE FROM security_group WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-1');

    WITH updated_subnet AS (
      UPDATE subnet
      SET region='${region}', availability_zone=(SELECT name FROM availability_zone WHERE region = '${region}' ORDER BY name LIMIT 1)
      WHERE cidr_block='192.${randIPBlock}.0.0/16' AND availability_zone='${nonDefaultRegionAvailabilityZone}' AND region = '${nonDefaultRegion}'
    )
    UPDATE vpc
    SET region='${region}', dhcp_options_id=NULL
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available' AND tags ->> 'name' = '${prefix}-1' AND region = '${nonDefaultRegion}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the region change of the vpc', commit());

  it(
    'check vpc in old region',
    query(
      `
    SELECT * FROM vpc 
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${nonDefaultRegion}';
  `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check vpc is available in the new region',
    query(
      `
    SELECT * FROM vpc 
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available' AND tags ->> 'name' = '${prefix}-1' AND region = '${region}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check subnet is available in the new region',
    query(
      `
    SELECT * FROM subnet
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND availability_zone=(SELECT name FROM availability_zone WHERE region='${region}' ORDER BY name LIMIT 1) AND region = '${region}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the vpc module', uninstall(modules));

  it('installs the vpc module again (to make sure it reloads stuff)', install(modules));

  it(
    'check vpc is available in the new region',
    query(
      `
    SELECT * FROM vpc 
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available' AND tags ->> 'name' = '${prefix}-1' AND region = '${region}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the vpcs',
    query(
      `
    DELETE FROM security_group_rule
    WHERE security_group_id = (
      SELECT id
      FROM security_group
      WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${region}'
      )
    );
    DELETE FROM route_table_association
    WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${region}'
    );
    DELETE FROM route
    WHERE route_table_id = (
      SELECT id
      FROM route_table
      WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${region}'
      )
    );
    DELETE FROM route_table
    WHERE vpc_id = (
      SELECT id
      FROM vpc
      WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${region}'
    );
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${region}'
    )
    DELETE FROM security_group
    USING vpc
    WHERE vpc_id = vpc.id;

    DELETE FROM subnet
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${region}';

    DELETE FROM vpc
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${region}';

    DELETE FROM security_group_rule
    WHERE security_group_id = (
      SELECT id
      FROM security_group
      WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block='191.${randIPBlock}.0.0/16' AND region = 'us-east-1'
      )
    );
    DELETE FROM route_table_association
    WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block='191.${randIPBlock}.0.0/16' AND region = 'us-east-1'
    );
    DELETE FROM route
    WHERE route_table_id = (
      SELECT id
      FROM route_table
      WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block='191.${randIPBlock}.0.0/16' AND region = 'us-east-1'
      )
    );
    DELETE FROM route_table
    WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block='191.${randIPBlock}.0.0/16' AND region = 'us-east-1'
    );
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE cidr_block='191.${randIPBlock}.0.0/16' AND region = 'us-east-1'
    )
    DELETE FROM security_group
    USING vpc
    WHERE vpc_id = vpc.id;

    DELETE FROM subnet
    WHERE cidr_block='191.${randIPBlock}.0.0/16' AND region = 'us-east-1';

    DELETE FROM vpc
    WHERE cidr_block='191.${randIPBlock}.0.0/16' AND region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the vpc removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
