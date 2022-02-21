import { LoadBalancerStateEnum } from '@aws-sdk/client-elastic-load-balancing-v2';
import { IpAddressType, LoadBalancerSchemeEnum, LoadBalancerTypeEnum, ProtocolEnum, TargetTypeEnum } from '../../src/modules/aws_elb@0.0.1/entity';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, finish, execComposeUp, execComposeDown, } from '../helpers'

jest.setTimeout(360000);

beforeAll(execComposeUp);

afterAll(execComposeDown);

const prefix = getPrefix();
const dbAlias = 'elbtest';
const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);

// Test constants
const tgName = `${prefix}${dbAlias}tg`;
const lbName = `${prefix}${dbAlias}lb`;
const tgType = TargetTypeEnum.IP;
const port = 5678;
const protocol = ProtocolEnum.HTTP;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbType = LoadBalancerTypeEnum.APPLICATION;
const lbIPAddressType = IpAddressType.IPV4;

describe('ELB Integration Testing', () => {
  it('creates a new test db elb', (done) => void iasql.add(
    dbAlias,
    'us-west-2',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the elb module', (done) => void iasql.install(
    ['aws_security_group@0.0.1', 'aws_elb@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  // TODO: add tests with stored procedures
  // Target group
  it('adds a new targetGroup', query(`
    INSERT INTO aws_target_group (target_group_name, target_type, protocol, port, vpc, health_check_path)
    VALUES ('${tgName}', '${tgType}', '${protocol}', ${port}, 'default', '/health');
  `));

  it('check aws_target_group insertion', query(`
    SELECT *
    FROM aws_target_group
    WHERE target_group_name = '${tgName}'
    ORDER BY id DESC
    LIMIT 1;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the change', apply);

  it('tries to update a target group field', query(`
    UPDATE aws_target_group SET health_check_path = '/fake-health' WHERE target_group_name = '${tgName}';
  `));

  it('applies the change', apply);

  it('tries to update a target group field (replace)', query(`
    UPDATE aws_target_group SET port = 5677 WHERE target_group_name = '${tgName}';
  `));

  it('applies the change', apply);

  // Load balancer
  // TODO: add security groups insert when testing application load balancer integration
  it('adds a new load balancer', query(`
    BEGIN;
      INSERT INTO aws_load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
      VALUES ('${lbName}', '${lbScheme}', 'default', '${lbType}', '${lbIPAddressType}');
    COMMIT;
  `));

  it('check aws_load_balancer insertion', query(`
    SELECT *
    FROM aws_load_balancer
    WHERE load_balancer_name = '${lbName}'
    ORDER BY id DESC
    LIMIT 1;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the change', apply);

  it('tries to update a load balancer field', query(`
    UPDATE aws_load_balancer SET state = '${LoadBalancerStateEnum.FAILED}' WHERE load_balancer_name = '${lbName}';
  `));

  it('applies the change and restore it', apply);

  // TODO: add load balancer update of subnets or security group

  it('tries to update a target group field (replace)', query(`
    UPDATE aws_load_balancer SET scheme = '${LoadBalancerSchemeEnum.INTERNAL}' WHERE load_balancer_name = '${lbName}';
  `));

  it('applies the change', apply);

  it('adds a new listener', query(`
    BEGIN;
      INSERT INTO aws_action (action_type, target_group_id)
      SELECT  'forward', id
      FROM aws_target_group
      WHERE target_group_name = '${tgName}'
      ORDER BY id DESC
      LIMIT 1;
      INSERT INTO aws_listener (aws_load_balancer_id, port, protocol)
      SELECT id, ${port}, '${protocol}'
      FROM aws_load_balancer
      WHERE load_balancer_name = '${lbName}'
      ORDER BY id DESC
      LIMIT 1;
      INSERT INTO aws_listener_default_actions_aws_action (aws_listener_id, aws_action_id)
      SELECT aws_listener.id, aws_action.id
      FROM aws_listener, aws_action
      ORDER BY aws_listener.id DESC
      LIMIT 1;
    COMMIT;
  `));

  it('check aws_listener insertion', query(`
    SELECT *
    FROM aws_listener
    INNER JOIN aws_load_balancer ON aws_load_balancer.id = aws_listener.aws_load_balancer_id
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check aws_listener_default_actions_aws_action insertion', query(`
    SELECT *
    FROM aws_listener_default_actions_aws_action
    INNER JOIN aws_listener ON aws_listener.id = aws_listener_default_actions_aws_action.aws_listener_id
    INNER JOIN aws_load_balancer ON aws_load_balancer.id = aws_listener.aws_load_balancer_id
    WHERE load_balancer_name = '${lbName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the change', apply);

  it('tries to update a listener field', query(`
    UPDATE aws_listener
    SET port = ${port + 1}
    WHERE id IN (
      SELECT aws_listener.id
      FROM aws_listener
      INNER JOIN aws_load_balancer ON aws_load_balancer.id = aws_listener.aws_load_balancer_id
      WHERE load_balancer_name = '${lbName}'
      ORDER BY aws_listener.id DESC
      LIMIT 1
    );
  `));

  it('applies the change', apply);

  it('deletes the listener', query(`
    DELETE FROM aws_action
    WHERE id IN (
      SELECT aws_action_id
      FROM aws_listener_default_actions_aws_action
      WHERE aws_listener_id IN (
        SELECT aws_listener.id
        FROM aws_listener
        INNER JOIN aws_load_balancer ON aws_load_balancer.id = aws_listener.aws_load_balancer_id
        WHERE load_balancer_name = '${lbName}'
        ORDER BY aws_listener.id DESC
        LIMIT 1
      )
    );
    DELETE FROM aws_listener
    WHERE id IN (
      SELECT aws_listener.id
      FROM aws_listener
      INNER JOIN aws_load_balancer ON aws_load_balancer.id = aws_listener.aws_load_balancer_id
      WHERE load_balancer_name = '${lbName}'
      ORDER BY aws_listener.id DESC
      LIMIT 1
    );
  `));

  it('applies the change', apply);

  it('deletes the load balancer', query(`
    DELETE FROM aws_load_balancer
    WHERE load_balancer_name = '${lbName}';
  `));

  it('applies the change', apply);

  it('deletes the target group', query(`
    DELETE FROM aws_target_group
    WHERE target_group_name = '${tgName}';
  `));

  it('applies the change (last time)', apply);

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
