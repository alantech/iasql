import { LoadBalancerStateEnum } from '@aws-sdk/client-elastic-load-balancing-v2';
import config from '../../src/config';
import * as iasql from '../../src/services/iasql'
import {
  getPrefix,
  runQuery,
  runInstall,
  runUninstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
  getKeyCertPair,
} from '../helpers'

const {
  IpAddressType,
  LoadBalancerSchemeEnum,
  LoadBalancerTypeEnum,
  ProtocolEnum,
  TargetTypeEnum,
} = require(`../../src/modules/${config.modules.latestVersion}/aws_elb/entity`);

const prefix = getPrefix();
const dbAlias = 'elbtest';

const domainName = `${prefix}${dbAlias}.com`;
const [key, cert] = getKeyCertPair(domainName);

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_security_group', 'aws_elb', 'aws_vpc', 'aws_acm_list', 'aws_acm_import', 'aws_acm_request'];

// Test constants
const tgName = `${prefix}${dbAlias}tg`;
const lbName = `${prefix}${dbAlias}lb`;
const tgType = TargetTypeEnum.IP;
const port = 5678;
const portHTTPS = 443;
const protocol = ProtocolEnum.HTTP;
const protocolHTTPS = ProtocolEnum.HTTPS;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbType = LoadBalancerTypeEnum.APPLICATION;
const lbIPAddressType = IpAddressType.IPV4;
const sg1 = `${prefix}${dbAlias}lbsg1`;
const sg2 = `${prefix}${dbAlias}lbsg2`;

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('ELB Integration Testing', () => {
  it('creates a new test db elb', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('installs the elb module', install(modules));

  // Target group
  it('adds a new targetGroup', query(`
    INSERT INTO target_group (target_group_name, target_type, protocol, port, vpc, health_check_path)
    VALUES ('${tgName}', '${tgType}', '${protocol}', ${port}, null, '/health');
  `));

  it('undo changes', sync());

  it('check target_group insertion', query(`
    SELECT *
    FROM target_group
    WHERE target_group_name = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new targetGroup', query(`
    INSERT INTO target_group (target_group_name, target_type, protocol, port, vpc, health_check_path)
    VALUES ('${tgName}', '${tgType}', '${protocol}', ${port}, null, '/health');
  `));

  it('check target_group insertion', query(`
    SELECT *
    FROM target_group
    WHERE target_group_name = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the change', apply());

  it('tries to update a target group field', query(`
    UPDATE target_group SET health_check_path = '/fake-health' WHERE target_group_name = '${tgName}';
  `));

  it('applies the change', apply());

  it('tries to update a target group field (replace)', query(`
    UPDATE target_group SET port = 5677 WHERE target_group_name = '${tgName}';
  `));

  it('applies the change', apply());

  // Load balancer
  it('adds a new load balancer', query(`
    INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
    VALUES ('${lbName}', '${lbScheme}', null, '${lbType}', '${lbIPAddressType}');
  `));

  it('undo changes', sync());

  it('check load_balancer insertion', query(`
    SELECT *
    FROM load_balancer
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(0)));
  
  it('adds new security groups', query(`
    INSERT INTO security_group (description, group_name)
    VALUES ('Security Group Test 1', '${sg1}');
    INSERT INTO security_group (description, group_name)
    VALUES ('Security Group Test 2', '${sg2}');
  `));

  it('applies the change', apply());

  it('adds a new load balancer', query(`
    BEGIN;
      INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
      VALUES ('${lbName}', '${lbScheme}', null, '${lbType}', '${lbIPAddressType}');

      INSERT INTO load_balancer_security_groups(load_balancer_name, security_group_id)
      SELECT '${lbName}', (SELECT id FROM security_group WHERE group_name = '${sg1}');
    COMMIT;
  `));

  it('check load_balancer insertion', query(`
    SELECT *
    FROM load_balancer
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check load_balancer_security_groups insertion', query(`
    SELECT *
    FROM load_balancer_security_groups
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the change', apply());

  it('tries to update a load balancer field', query(`
    UPDATE load_balancer SET state = '${LoadBalancerStateEnum.FAILED}' WHERE load_balancer_name = '${lbName}';
  `));

  it('applies the change and restore it', apply());

  it('tries to update a load balancer security group (replace)', query(`
    UPDATE load_balancer_security_groups
    SET security_group_id = (SELECT id FROM security_group WHERE group_name = '${sg2}')
    WHERE load_balancer_name = '${lbName}';
  `));

  it('applies the change', apply());

  it('tries to update a target group field (replace)', query(`
    UPDATE load_balancer SET scheme = '${LoadBalancerSchemeEnum.INTERNAL}' WHERE load_balancer_name = '${lbName}';
  `));

  it('applies the change', apply());

  it('adds a new listener', query(`
    INSERT INTO listener (load_balancer_name, port, protocol, target_group_name)
    VALUES ('${lbName}', ${port}, '${protocol}', '${tgName}');
  `));

  it('check listener insertion', query(`
    SELECT *
    FROM listener
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the change', apply());

  it('tries to update a listener field', query(`
    UPDATE listener
    SET port = ${port + 1}
    WHERE load_balancer_name = '${lbName}';
  `));

  it('applies the change', apply());

  it('adds a new certificate to import', query(`
    INSERT INTO certificate_import (certificate, private_key)
    VALUES ('${cert}', '${key}');
  `));

  it('check adds new certificate to import', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the new certificate import', apply());

  it('check import row delete', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check new certificate added', query(`
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('adds a new HTTPS listener', query(`
    INSERT INTO listener (load_balancer_name, port, protocol, target_group_name, certificate_id)
    SELECT '${lbName}', ${portHTTPS}, '${protocolHTTPS}', '${tgName}', id
    FROM certificate
    WHERE domain_name = '${domainName}';
  `));

  it('check https listener insertion', query(`
    SELECT *
    FROM listener
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('applies the https listener change', apply());

  it('check https listener insertion', query(`
    SELECT *
    FROM listener
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  it('uninstalls the elb module', uninstall(
    ['aws_elb']));

  it('installs the elb module', install(
    ['aws_elb']));

  it('deletes the listener', query(`
    DELETE FROM listener
    WHERE load_balancer_name = '${lbName}';
  `));

  it('check listener delete', query(`
    SELECT *
    FROM listener
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the change', apply());

  it('deletes the load balancer', query(`
    DELETE FROM load_balancer
    WHERE load_balancer_name = '${lbName}';
  `));

  it('check load_balancer delete', query(`
    SELECT *
    FROM load_balancer
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the security groups', query(`
    DELETE FROM security_group
    WHERE group_name IN ('${sg1}', '${sg2}');
  `));

  it('check load_balancer delete', query(`
    SELECT *
    FROM security_group
    WHERE group_name IN ('${sg1}', '${sg2}');
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the change', apply());

  it('deletes the target group', query(`
    DELETE FROM target_group
    WHERE target_group_name = '${tgName}';
  `));

  it('check target_group deletion', query(`
    SELECT *
    FROM target_group
    WHERE target_group_name = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the change (last time)', apply());

  it('deletes the certificate', query(`
    DELETE FROM certificate
    WHERE domain_name = '${domainName}';
  `));

  it('check certificate deletion', query(`
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the cert delete change', apply());

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('ELB install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('installs the ELB module', install(
    modules));

  it('uninstalls the ELB module', uninstall(
    modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the ELB module and its dependent ones', uninstall(
    ['aws_elb', 'aws_ecs_fargate', 'aws_ecs_simplified', 'aws_ec2', 'aws_ec2_metadata', 'aws_route53_hosted_zones', 'aws_acm_request', 'aws_vpc', 'aws_acm_list', 'aws_acm_import', 'aws_acm_request', 'aws_security_group', 'aws_memory_db']));

  it('installs the ELB module', install(
    ['aws_elb',]));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
