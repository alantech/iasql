import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import { runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, getPrefix, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'vpctest';
const ng = `${prefix}${dbAlias}-ng`;
const eip = `${prefix}${dbAlias}-eip`;
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
// We have to install the `aws_security_group` to test fully the integration even though is not being used,
// since the `aws_vpc` module creates a `default` security group automatically.
const modules = ['aws_vpc', 'aws_security_group'];

const availabilityZone = `${process.env.AWS_REGION ?? 'barf'}a`;
const randIPBlock = Math.floor(Math.random() * 255);

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('VPC Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the vpc module', install(modules));

  it('adds a new vpc', query(`  
    INSERT INTO vpc (cidr_block)
    VALUES ('192.${randIPBlock}.0.0/16');
  `));

  it('undo changes', sync());

  it('adds a new vpc', query(`  
    INSERT INTO vpc (cidr_block)
    VALUES ('192.${randIPBlock}.0.0/16');
  `));

  it('applies the vpc change', apply());

  it('adds a subnet', query(`
    INSERT INTO subnet (availability_zone, vpc_id, cidr_block)
    SELECT '${availabilityZone}', id, '192.${randIPBlock}.0.0/16'
    FROM vpc
    WHERE is_default = false
    AND cidr_block = '192.${randIPBlock}.0.0/16';
  `));

  it('applies the subnet change', apply());

  it('adds a new elastic ip', query(`
    INSERT INTO elastic_ip (tags)
    VALUES ('{"name": "${eip}"}');
  `));

  it('check elastic ip count', query(`
    SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
  `, (res: any) => expect(res.length).toBe(1)));

  it('applies the elastic ip change', apply());

  it('check elastic ip count', query(`
    SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
  `, (res: any) => expect(res.length).toBe(1)));

  it('adds a new vpc', query(`  
    INSERT INTO vpc (cidr_block)
    VALUES ('192.${randIPBlock}.0.0/16');
  `));

  it('applies the vpc change', apply());

  it('adds a nat gateway', query(`
    INSERT INTO nat_gateway (connectivity_type, subnet_id, tags)
    SELECT 'private', id, '{"Name":"${ng}"}'
    FROM subnet
    WHERE cidr_block = '192.${randIPBlock}.0.0/16';
  `));

  it('applies the nat gateway change', apply());

  it('check nat gateway count', query(`
    SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
  `, (res: any) => expect(res.length).toBe(1)));

  it('uninstalls the vpc module', uninstall(
    modules));

  it('installs the vpc module again (to make sure it reloads stuff)', install(
    modules));

  it('check nat gateway count', query(`
    SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
  `, (res: any) => expect(res.length).toBe(1)));

  it('queries the subnets to confirm the record is present', query(`
    SELECT * FROM subnet WHERE cidr_block = '192.${randIPBlock}.0.0/16'
  `, (res: any) => expect(res.length).toBeGreaterThan(0)));

  it('queries the vpcs to confirm the record is present', query(`
    SELECT * FROM vpc WHERE cidr_block = '192.${randIPBlock}.0.0/16'
  `, (res: any) => expect(res.length).toBeGreaterThan(0)));

  it('updates a elastic ip', query(`
    UPDATE elastic_ip
    SET tags = '{"name": "${eip}", "updated": "true"}'
    WHERE tags ->> 'name' = '${eip}';
  `));

  it('applies the elastic ip change', apply());

  it('check elastic ip count', query(`
    SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
  `, (res: any) => expect(res.length).toBe(1)));

  it('checks elastic ip update', query(`
    SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
  `, (res: any) => expect(res[0]['tags']['updated']).toBe('true')));

  it('deletes a elastic ip', query(`
    DELETE FROM elastic_ip
    WHERE tags ->> 'name' = '${eip}';
  `));

  it('applies the elastic ip change', apply());

  it('check elastic ip count', query(`
    SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
  `, (res: any) => expect(res.length).toBe(0)));

  it('updates a nat gateway', query(`
    UPDATE nat_gateway
    SET state = 'failed'
    WHERE tags ->> 'Name' = '${ng}';
  `));

  it('applies the nat gateway change', apply());

  it('check nat gateway count', query(`
    SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
  `, (res: any) => expect(res.length).toBe(1)));

  it('check nat gateway state', query(`
    SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
  `, (res: any) => expect(res[0]['state']).toBe('available')));

  it('deletes a nat gateway', query(`
    DELETE FROM nat_gateway
    WHERE tags ->> 'Name' = '${ng}';
  `));

  it('applies the nat gateway change', apply());

  it('check nat gateway count', query(`
    SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
  `, (res: any) => expect(res.length).toBe(0)));

  it('deletes the subnet', query(`
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE is_default = false
      AND cidr_block = '192.${randIPBlock}.0.0/16'
    )
    DELETE FROM subnet
    USING vpc
    WHERE vpc_id = vpc.id;
  `));

  it('applies the subnet removal', apply());

  it('deletes the vpc', query(`
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE cidr_block = '192.${randIPBlock}.0.0/16'
    )
    DELETE FROM security_group
    USING vpc
    WHERE vpc_id = vpc.id;

    DELETE FROM vpc
    WHERE cidr_block = '192.${randIPBlock}.0.0/16';
  `));

  it('applies the vpc removal', apply());

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('VPC install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the VPC module', install(
    modules));

  it('uninstalls the VPC module', uninstall(
    modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the VPC module', uninstall(
    ['aws_vpc', 'aws_ecs_fargate', 'aws_security_group', 'aws_rds', 'aws_elb', 'aws_ec2', 'aws_ec2_metadata', 'aws_route53_hosted_zones']));

  it('installs the VPC module', install(
    ['aws_vpc',]));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
