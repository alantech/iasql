import * as iasql from '../../src/services/iasql'
import { runQuery, runApply, finish, execComposeUp, execComposeDown, } from '../helpers'

jest.setTimeout(240000);

beforeAll(execComposeUp);

afterAll(execComposeDown);

const dbAlias = 'vpctest';
const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const availabilityZone = `${process.env.AWS_REGION ?? 'barf'}a`;

const randIPBlock = Math.floor(Math.random() * 255);

describe('VPC Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the vpc module', (done) => void iasql.install(
    ['aws_vpc@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('adds a new vpc', query(`  
    INSERT INTO aws_vpc (cidr_block)
    VALUES ('192.${randIPBlock}.0.0/16');
  `));

  it('applies the vpc change', apply);

  it('adds a subnet', query(`
    INSERT INTO aws_subnet (availability_zone, vpc_id, cidr_block)
    SELECT '${availabilityZone}', id, '192.${randIPBlock}.0.0/16'
    FROM aws_vpc
    WHERE is_default = false
    AND cidr_block = '192.${randIPBlock}.0.0/16';
  `));

  it('applies the subnet change', apply);

  it('uninstalls the vpc module', (done) => void iasql.uninstall(
    ['aws_vpc@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('installs the vpc module again (to make sure it reloads stuff)', (done) => void iasql.install(
    ['aws_vpc@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('queries the subnets to confirm the record is present', query(`
    SELECT * FROM aws_subnet WHERE cidr_block = '192.${randIPBlock}.0.0/16'
  `, (res: any) => expect(res.length).toBeGreaterThan(0)));

  it('queries the vpcs to confirm the record is present', query(`
    SELECT * FROM aws_vpc WHERE cidr_block = '192.${randIPBlock}.0.0/16'
  `, (res: any) => expect(res.length).toBeGreaterThan(0)));

  it('deletes the subnet', query(`
    WITH vpc as (
      SELECT id
      FROM aws_vpc
      WHERE is_default = false
      AND cidr_block = '192.${randIPBlock}.0.0/16'
    )
    DELETE FROM aws_subnet
    USING vpc
    WHERE vpc_id = vpc.id;
  `));

  it('applies the subnet removal', apply);

  it('deletes the vpc', query(`
    DELETE FROM aws_vpc
    WHERE cidr_block = '192.${randIPBlock}.0.0/16';
  `));

  it('applies the vpc removal', apply);

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('VPC install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    'us-east-1', // Share region with common tests
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the VPC module', (done) => void iasql.install(
    ['aws_vpc@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('uninstalls the VPC module', (done) => void iasql.uninstall(
    ['aws_vpc@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    'not-needed',
    true).then(...finish(done)));

  it('uninstalls the VPC module', (done) => void iasql.uninstall(
    ['aws_vpc@0.0.1', 'aws_ecs_fargate@0.0.1',],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('installs the VPC module', (done) => void iasql.install(
    ['aws_vpc@0.0.1', 'aws_ecs_fargate@0.0.1',],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
