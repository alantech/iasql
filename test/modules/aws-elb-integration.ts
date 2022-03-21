import { LoadBalancerStateEnum } from '@aws-sdk/client-elastic-load-balancing-v2';
import { IpAddressType, LoadBalancerSchemeEnum, LoadBalancerTypeEnum, ProtocolEnum, TargetTypeEnum } from '../../src/modules/aws_elb@0.0.1/entity';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'elbtest';
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_security_group@0.0.1', 'aws_elb@0.0.1'];

// Test constants
const tgName = `${prefix}${dbAlias}tg`;
const lbName = `${prefix}${dbAlias}lb`;
const tgType = TargetTypeEnum.IP;
const port = 5678;
const protocol = ProtocolEnum.HTTP;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbType = LoadBalancerTypeEnum.APPLICATION;
const lbIPAddressType = IpAddressType.IPV4;

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('ELB Integration Testing', () => {
  it('creates a new test db elb', (done) => void iasql.add(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the elb module', install(modules));

  // TODO: add tests with stored procedures
  // Target group
  it('adds a new targetGroup', query(`
    INSERT INTO target_group (target_group_name, target_type, protocol, port, vpc, health_check_path)
    VALUES ('${tgName}', '${tgType}', '${protocol}', ${port}, 'default', '/health');
  `));

  it('undo changes', sync());

  it('check target_group insertion', query(`
    SELECT *
    FROM target_group
    WHERE target_group_name = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new targetGroup', query(`
    INSERT INTO target_group (target_group_name, target_type, protocol, port, vpc, health_check_path)
    VALUES ('${tgName}', '${tgType}', '${protocol}', ${port}, 'default', '/health');
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
  // TODO: add security groups insert when testing application load balancer integration
  it('adds a new load balancer', query(`
    INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
    VALUES ('${lbName}', '${lbScheme}', 'default', '${lbType}', '${lbIPAddressType}');
  `));

  it('undo changes', sync());

  it('check load_balancer insertion', query(`
    SELECT *
    FROM load_balancer
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(0)));
  
  it('adds a new load balancer', query(`
    INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
    VALUES ('${lbName}', '${lbScheme}', 'default', '${lbType}', '${lbIPAddressType}');
  `));

  it('check load_balancer insertion', query(`
    SELECT *
    FROM load_balancer
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the change', apply());

  it('tries to update a load balancer field', query(`
    UPDATE load_balancer SET state = '${LoadBalancerStateEnum.FAILED}' WHERE load_balancer_name = '${lbName}';
  `));

  it('applies the change and restore it', apply());

  // TODO: add load balancer update of subnets or security group

  it('tries to update a target group field (replace)', query(`
    UPDATE load_balancer SET scheme = '${LoadBalancerSchemeEnum.INTERNAL}' WHERE load_balancer_name = '${lbName}';
  `));

  it('applies the change', apply());

  it('adds a new listener', query(`
    WITH target_group AS (
      SELECT id
      FROM target_group
      WHERE target_group_name = '${tgName}'
      ORDER BY id DESC
      LIMIT 1
    ), load_balancer AS (
      SELECT id
      FROM load_balancer
      WHERE load_balancer_name = '${lbName}'
      ORDER BY id DESC
      LIMIT 1
    )
    INSERT INTO listener (load_balancer_id, port, protocol, target_group_id)
    VALUES ((SELECT id FROM load_balancer), ${port}, '${protocol}', (SELECT id FROM target_group));
  `));

  it('check listener insertion', query(`
    SELECT *
    FROM listener
    INNER JOIN load_balancer ON load_balancer.id = listener.load_balancer_id
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the change', apply());

  it('tries to update a listener field', query(`
    UPDATE listener
    SET port = ${port + 1}
    WHERE id IN (
      SELECT listener.id
      FROM listener
      INNER JOIN load_balancer ON load_balancer.id = listener.load_balancer_id
      WHERE load_balancer_name = '${lbName}'
      ORDER BY listener.id DESC
      LIMIT 1
    );
  `));

  it('applies the change', apply());

  it('uninstalls the elb module', uninstall(
    ['aws_elb@0.0.1']));

  it('installs the elb module', install(
    ['aws_elb@0.0.1']));

  it('deletes the listener', query(`
    DELETE FROM listener
    USING load_balancer
    WHERE load_balancer_name = '${lbName}' and load_balancer.id = listener.load_balancer_id;
  `));

  it('check listener delete', query(`
    SELECT *
    FROM listener
    INNER JOIN load_balancer ON load_balancer.id = listener.load_balancer_id
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

  it('applies the change', apply());

  it('deletes the target group', query(`
    DELETE FROM target_group
    WHERE target_group_name = '${tgName}';
  `));

  it('check target_group insertion', query(`
    SELECT *
    FROM target_group
    WHERE target_group_name = '${tgName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('applies the change (last time)', apply());

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('ELB install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    'us-east-1', // Share region with common tests
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the ELB module', install(
    modules));

  it('uninstalls the ELB module', uninstall(
    modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    'not-needed',
    true).then(...finish(done)));

  it('uninstalls the ELB module', uninstall(
    ['aws_elb@0.0.1', 'aws_ecs_fargate@0.0.1']));

  it('installs the ELB module', install(
    ['aws_elb@0.0.1',]));

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
