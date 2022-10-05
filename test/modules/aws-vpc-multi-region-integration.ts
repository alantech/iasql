import * as iasql from '../../src/services/iasql'
import { runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, getPrefix, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'vpctest';
const nonDefaultRegion = 'us-east-1';
const nonDefaultRegionAvailabilityZone = 'us-east-1a';
const availabilityZone = `${process.env.AWS_REGION ?? 'barf'}a`;

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
