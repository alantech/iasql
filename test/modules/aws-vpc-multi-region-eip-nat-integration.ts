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
const ng = `${prefix}${dbAlias}-ng`;
const pubNg = `${prefix}${dbAlias}-pub-ng1`;
const eip = `${prefix}${dbAlias}-eip`;

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

describe('VPC Multi-region EIP and NAT Gateway Integration Testing', () => {
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
        INSERT INTO vpc (cidr_block)
        VALUES ('192.${randIPBlock}.0.0/16');
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
        INSERT INTO subnet (availability_zone, vpc_id, cidr_block)
        SELECT (SELECT name FROM availability_zone WHERE region = '${region}' ORDER BY 1 DESC LIMIT 1), id, '192.${randIPBlock}.0.0/16'
        FROM vpc
        WHERE is_default = false
        AND cidr_block = '192.${randIPBlock}.0.0/16' AND region = '${region}';
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
        WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available' AND region = '${region}';
      `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a new elastic ip',
    query(
      `
        INSERT INTO elastic_ip (tags)
        VALUES ('{"name": "${eip}"}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the elastic ip change', commit());

  it(
    'check elastic ip count',
    query(
      `
        SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
      `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a private nat gateway',
    query(
      `
        INSERT INTO nat_gateway (connectivity_type, subnet_id, tags)
        SELECT 'private', id, '{"Name":"${ng}"}'
        FROM subnet
        WHERE cidr_block = '192.${randIPBlock}.0.0/16' AND region = '${region}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the private nat gateway change', commit());

  it(
    'checks private nat gateway count',
    query(
      `
        SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
      `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'updates the private nat gateway to another region',
    query(
      `
        INSERT INTO vpc (cidr_block, region)
        VALUES ('192.${randIPBlock}.0.0/16', '${nonDefaultRegion}');
        INSERT INTO subnet (availability_zone, vpc_id, cidr_block, region)
        SELECT (SELECT name FROM availability_zone WHERE region = '${nonDefaultRegion}' ORDER BY 1 DESC LIMIT 1), id, '192.${randIPBlock}.0.0/16', '${nonDefaultRegion}'
        FROM vpc
        WHERE is_default = false AND region = '${nonDefaultRegion}' AND cidr_block = '192.${randIPBlock}.0.0/16';
        UPDATE nat_gateway
        SET
          region = '${nonDefaultRegion}',
          subnet_id = (SELECT id FROM subnet WHERE cidr_block = '192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}')
        WHERE tags ->> 'Name' = '${ng}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the private nat gateway region change', commit());

  it(
    'checks private nat gateway count',
    query(
      `
    SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds a public nat gateway with existing elastic ip',
    query(
      `
        INSERT INTO nat_gateway (connectivity_type, subnet_id, tags, elastic_ip_id)
        SELECT 'public', subnet.id, '{"Name":"${pubNg}"}', elastic_ip.id
        FROM subnet, elastic_ip
        WHERE cidr_block = '192.${randIPBlock}.0.0/16' AND elastic_ip.tags ->> 'name' = '${eip}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the public nat gateway with existing elastic ip change', commit());

  it(
    'checks public nat gateway with existing elastic ip count',
    query(
      `
        SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg}';
      `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'moves the nat gateway and elastic IP to another region',
    query(
      `
        -- Detaching and re-attaching the elastic IP record to avoid join issues
        UPDATE nat_gateway
        SET 
          elastic_ip_id = NULL,
          region = '${nonDefaultRegion}',
          subnet_id = (SELECT id FROM subnet WHERE cidr_block = '192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}')
        WHERE tags ->> 'Name' = '${pubNg}';
        UPDATE elastic_ip SET region='${nonDefaultRegion}' WHERE tags ->> 'name' = '${eip}';
        UPDATE nat_gateway
        SET
          elastic_ip_id = (SELECT id from elastic_ip WHERE tags ->> 'name' = '${eip}')
        WHERE tags ->> 'Name' = '${pubNg}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the nat gateway and elastic IP move', commit());

  it(
    'checks public nat gateway with existing elastic ip count',
    query(
      `
        SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg}';
      `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes a public nat gateway',
    query(
      `
        DELETE FROM nat_gateway
        WHERE tags ->> 'Name' = '${pubNg}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'deletes a elastic ip',
    query(
      `
        DELETE FROM elastic_ip
        WHERE tags ->> 'name' = '${eip}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'deletes a private nat gateway',
    query(
      `
        DELETE FROM nat_gateway
        WHERE tags ->> 'Name' = '${ng}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the nat gateway and elastic IP deletions', commit());

  it(
    'checks public nat gateways count',
    query(
      `
        SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg}';
      `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check elastic ip count',
    query(
      `
        SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
      `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'checks private nat gateway count',
    query(
      `
        SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
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
            WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${region}'
          )
        );
        DELETE FROM route_table_association
        WHERE vpc_id = (
            SELECT id
            FROM vpc
            WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${region}'
        );
        DELETE FROM route_table
        WHERE vpc_id = (
          SELECT id
          FROM vpc
          WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${region}'
        );
        WITH vpc as (
          SELECT id
          FROM vpc
          WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${region}'
        )
        DELETE FROM security_group
        USING vpc
        WHERE vpc_id = vpc.id;

        DELETE FROM subnet
        WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${region}';

        DELETE FROM vpc
        WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${region}';

        DELETE FROM security_group_rule
        WHERE security_group_id = (
          SELECT id
          FROM security_group
          WHERE vpc_id = (
            SELECT id
            FROM vpc
            WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}'
          )
        );
        DELETE FROM route_table_association
        WHERE vpc_id = (
            SELECT id
            FROM vpc
            WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}'
        );
        DELETE FROM route_table
        WHERE vpc_id = (
            SELECT id
            FROM vpc
            WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}'
        );
        WITH vpc as (
          SELECT id
          FROM vpc
          WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}'
        )
        DELETE FROM security_group
        USING vpc
        WHERE vpc_id = vpc.id;

        DELETE FROM subnet
        WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}';

        DELETE FROM vpc
        WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the vpc removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
