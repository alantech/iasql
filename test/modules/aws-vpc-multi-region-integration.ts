import * as iasql from '../../src/services/iasql'
import { runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, getPrefix, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'vpctest';
const nonDefaultRegion = 'us-east-1';
const nonDefaultRegionAvailabilityZone = 'us-east-1a';
const availabilityZone = `${process.env.AWS_REGION ?? 'barf'}a`;
const ng = `${prefix}${dbAlias}-ng`;
const pubNg = `${prefix}${dbAlias}-pub-ng1`;
const eip = `${prefix}${dbAlias}-eip`;
const s3VpcEndpoint = `${prefix}${dbAlias}-s3-vpce`;

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
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

describe('VPC Multiregion Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${process.env.AWS_REGION}';
  `));

  it('installs the vpc module', install(modules));

  it('adds a new vpc', query(`  
    INSERT INTO vpc (cidr_block, region)
    VALUES ('192.${randIPBlock}.0.0/16', '${nonDefaultRegion}');
  `));

  it('adds a subnet', query(`
    INSERT INTO subnet (availability_zone, vpc_id, cidr_block, region)
    SELECT '${nonDefaultRegionAvailabilityZone}', id, '192.${randIPBlock}.0.0/16', '${nonDefaultRegion}'
    FROM vpc
    WHERE is_default = false
    AND cidr_block = '192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}';
  `));

  it('undo changes', sync());

  it('adds a new vpc', query(`  
    INSERT INTO vpc (cidr_block, tags, region)
    VALUES ('192.${randIPBlock}.0.0/16', '{"name":"${prefix}-1"}', '${nonDefaultRegion}');
  `));

  it('adds a subnet', query(`
    INSERT INTO subnet (availability_zone, vpc_id, cidr_block, region)
    SELECT '${nonDefaultRegionAvailabilityZone}', id, '192.${randIPBlock}.0.0/16', '${nonDefaultRegion}'
    FROM vpc
    WHERE is_default = false
    AND cidr_block = '192.${randIPBlock}.0.0/16' AND region = '${nonDefaultRegion}';
  `));

  it('applies the vpc change', apply());

  it('check vpc is available', query(`
  SELECT * FROM vpc 
  WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available' AND tags ->> 'name' = '${prefix}-1' AND region = '${nonDefaultRegion}';
  ` , (res: any) => expect(res.length).toBe(1)));

  it('updates vpc region', query(`
    DELETE FROM security_group WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-1');
    WITH updated_subnet AS (
      UPDATE subnet
      SET region='${process.env.AWS_REGION}', availability_zone='${availabilityZone}'
      WHERE cidr_block='192.${randIPBlock}.0.0/16' AND availability_zone='${nonDefaultRegionAvailabilityZone}' AND region = '${nonDefaultRegion}'
    )
    UPDATE vpc
    SET region='${process.env.AWS_REGION}'
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available' AND tags ->> 'name' = '${prefix}-1' AND region = '${nonDefaultRegion}';
  `));

  it('applies the region change of the vpc', apply());

  it('check vpc in old region', query(`
    SELECT * FROM vpc 
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${nonDefaultRegion}';
  ` , (res: any) => expect(res.length).toBe(0)));

  it('check vpc is available in the new region', query(`
    SELECT * FROM vpc 
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available' AND tags ->> 'name' = '${prefix}-1' AND region = '${process.env.AWS_REGION}';
  ` , (res: any) => expect(res.length).toBe(1)));

  it('check subnet is available in the new region', query(`
    SELECT * FROM subnet
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND availability_zone='${availabilityZone}' AND region = '${process.env.AWS_REGION}';
  ` , (res: any) => expect(res.length).toBe(1)));

  it('uninstalls the vpc module', uninstall(
    modules));

  it('installs the vpc module again (to make sure it reloads stuff)', install(
    modules));

  it('check vpc is available in the new region', query(`
    SELECT * FROM vpc 
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available' AND tags ->> 'name' = '${prefix}-1' AND region = '${process.env.AWS_REGION}';
  ` , (res: any) => expect(res.length).toBe(1)));

  describe('Elastic IP and nat gateway multi-region', () => {
    it('adds a new elastic ip', query(`
      INSERT INTO elastic_ip (tags)
      VALUES ('{"name": "${eip}"}');
    `));

    it('applies the elastic ip change', apply());

    it('check elastic ip count', query(`
      SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
    `, (res: any) => expect(res.length).toBe(1)));

    it('adds a private nat gateway', query(`
      INSERT INTO nat_gateway (connectivity_type, subnet_id, tags)
      SELECT 'private', id, '{"Name":"${ng}"}'
      FROM subnet
      WHERE cidr_block = '192.${randIPBlock}.0.0/16';
    `));

    it('applies the private nat gateway change', apply());

    it('checks private nat gateway count', query(`
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
    `, (res: any) => expect(res.length).toBe(1)));

    it('updates the private nat gateway to another region', query(`
      UPDATE nat_gateway SET region='us-east-1' WHERE tags ->> 'Name' = '${ng}';
    `));

    it('applies the private nat gateway region change', apply());

    it('checks private nat gateway count', query(`
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
    `, (res: any) => expect(res.length).toBe(1)));

    it('adds a public nat gateway with existing elastic ip', query(`
      INSERT INTO nat_gateway (connectivity_type, subnet_id, tags, elastic_ip_id)
      SELECT 'public', subnet.id, '{"Name":"${pubNg}"}', elastic_ip.id
      FROM subnet, elastic_ip
      WHERE cidr_block = '192.${randIPBlock}.0.0/16' AND elastic_ip.tags ->> 'name' = '${eip}';
    `));

    it('applies the public nat gateway with existing elastic ip change', apply());

    it('checks public nat gateway with existing elastic ip count', query(`
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg}';
    `, (res: any) => expect(res.length).toBe(1)));

    it('moves the nat gateway and elastic IP to another region', query(`
      -- Detaching and re-attaching the elastic IP record to avoid join issues
      UPDATE nat_gateway SET elastic_ip_id = NULL, region='us-east-1'
      WHERE tags ->> 'Name' = '${pubNg}';
      UPDATE elastic_ip SET region='us-east-1' WHERE tags ->> 'name' = '${eip}';
      UPDATE nat_gateway
      SET elastic_ip_id = (SELECT id from elastic_ip WHERE tags ->> 'name' = '${eip}')
      WHERE tags ->> 'Name' = '${pubNg}';
    `));

    it('applies the nat gateway and elastic IP move', apply());

    it('checks public nat gateway with existing elastic ip count', query(`
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg}';
    `, (res: any) => expect(res.length).toBe(1)));

    it('deletes a public nat gateway', query(`
      DELETE FROM nat_gateway
      WHERE tags ->> 'Name' = '${pubNg}';
    `));

    it('deletes a elastic ip', query(`
      DELETE FROM elastic_ip
      WHERE tags ->> 'name' = '${eip}';
    `));

    it('deletes a private nat gateway', query(`
      DELETE FROM nat_gateway
      WHERE tags ->> 'Name' = '${ng}';
    `));

    it('applies the nat gateway and elastic IP deletions', apply());

    it('checks public nat gateways count', query(`
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg}';
    `, (res: any) => expect(res.length).toBe(0)));

    it('check elastic ip count', query(`
      SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
    `, (res: any) => expect(res.length).toBe(0)));

    it('checks private nat gateway count', query(`
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
    `, (res: any) => expect(res.length).toBe(0)));
  });

  describe('VPC endpoint gateway multi-region', () => {
    it('adds a new s3 endpoint gateway', query(`
      INSERT INTO endpoint_gateway (service, vpc_id, tags)
      SELECT 's3', id, '{"Name": "${s3VpcEndpoint}"}'
      FROM vpc
      WHERE is_default = false
      AND cidr_block = '192.${randIPBlock}.0.0/16';
    `));

    it('checks endpoint gateway count', query(`
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `, (res: any) => expect(res.length).toBe(1)));

    it('applies the endpoint gateway change', apply());

    it('checks endpoint gateway count', query(`
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `, (res: any) => expect(res.length).toBe(1)));

    it('moves the endpoint gateway to another region', query(`
      UPDATE endpoint_gateway SET region='us-east-1' WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `));

    it('applies the endpoint gateway region change', apply());

    it('checks endpoint gateway count', query(`
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `, (res: any) => expect(res.length).toBe(1)));

    it('deletes a endpoint_gateway', query(`
      DELETE FROM endpoint_gateway
      WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `));

    it('applies the endpoint_gateway change', apply());

    it('checks endpoint_gateway count', query(`
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `, (res: any) => expect(res.length).toBe(0)));
  });

  it('deletes the vpc', query(`
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${process.env.AWS_REGION}'
    )
    DELETE FROM security_group
    USING vpc
    WHERE vpc_id = vpc.id;

    DELETE FROM subnet
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region = '${process.env.AWS_REGION}';

    DELETE FROM vpc
    WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-1' AND region = '${process.env.AWS_REGION}';
  `));

  it('applies the vpc removal', apply());

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
