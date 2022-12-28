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
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'vpctest';
const region = defaultRegion();
const nonDefaultRegion = 'us-east-1';
const nonDefaultRegionAvailabilityZone = 'us-east-1a';
const s3VpcEndpoint = `${prefix}${dbAlias}-s3-vpce`;

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
// We have to install the `aws_security_group` to test fully the integration even though is not being used,
// since the `aws_vpc` module creates a `default` security group automatically.
const modules = ['aws_vpc', 'aws_security_group'];

const randIPBlock = Math.floor(Math.random() * 254) + 1; // 0 collides with the default CIDR block

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('VPC Multi-region Endpoint Gateway Integration Testing', () => {
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
    'adds a new s3 endpoint gateway',
    query(
      `
    INSERT INTO endpoint_gateway (service, vpc_id, tags)
    SELECT 's3', id, '{"Name": "${s3VpcEndpoint}"}'
    FROM vpc
    WHERE is_default = false
    AND cidr_block = '192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'checks endpoint gateway count',
    query(
      `
    SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('applies the endpoint gateway change', commit());

  it(
    'checks endpoint gateway count',
    query(
      `
    SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'moves the endpoint gateway to another region',
    query(
      `
    UPDATE endpoint_gateway
    SET
      region = 'us-east-1',
      route_table_ids = NULL, -- TODO: Handle this in the mapper instead?
      vpc_id = (SELECT id from vpc WHERE is_default = true AND region='us-east-1')
    WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the endpoint gateway region change', commit());

  it(
    'checks endpoint gateway count',
    query(
      `
    SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes a endpoint_gateway',
    query(
      `
    DELETE FROM endpoint_gateway
    WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the endpoint_gateway change', commit());

  it(
    'checks endpoint_gateway count',
    query(
      `
    SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(0),
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
