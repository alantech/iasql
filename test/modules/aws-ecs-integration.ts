import config from '../../src/config';
import { CpuMemCombination, TaskDefinitionStatus } from '../../src/modules/aws_ecs_fargate@0.0.1/entity';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runInstall, runUninstall, runQuery, runApply, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'ecstest';
const dbAliasSidecar = `${dbAlias}sync`;
const sidecarSync = runSync.bind(null, dbAliasSidecar);
const sidecarInstall = runInstall.bind(null, dbAliasSidecar);
const region = process.env.AWS_REGION || 'barf';
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const querySync = runQuery.bind(null, dbAliasSidecar);
const installSync = runInstall.bind(null, dbAliasSidecar);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_ecr', 'aws_elb', 'aws_security_group', 'aws_cloudwatch', 'aws_ecs_fargate', 'aws_vpc', 'aws_iam'];

// Test constants
const serviceName = `${prefix}${dbAlias}service`;
const clusterName = `${prefix}${dbAlias}cluster`;
const newClusterName = `${prefix}${dbAlias}clusternew`;
const logGroupName = `${prefix}${dbAlias}loggroup`;
const containerName = `${prefix}${dbAlias}container`;
const containerNameTag = `${prefix}${dbAlias}containertg`;
const containerNameDigest = `${prefix}${dbAlias}containerdgst`;
const image = 'redis';
const imageTag = 'latest';
const imageDigest = 'sha256:0079affeb8a75e09d6d7f0ac30c31e5d35ca93ad86faa682cdb7c2228c8439db';
const containerMemoryReservation = 2048;  // MiB
const containerEssential = true;
const containerPort = 6379;
const hostPort = 6379;
const protocol = 'tcp';
const tdFamily = `${prefix}${dbAlias}td`;
const taskExecRoleName = `${prefix}${dbAlias}ecsTaskExecRole-${region}`;
const taskRolePolicyDoc = JSON.stringify({
  "Version": "2012-10-17",
  "Statement": [
      {
          "Sid": "",
          "Effect": "Allow",
          "Principal": {
              "Service": "ecs-tasks.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
      }
  ]
});
const taskPolicyArn = 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy';
const tdCpuMem = CpuMemCombination['vCPU2-8GB'];
const tdActive = TaskDefinitionStatus.ACTIVE;
const serviceDesiredCount = 1;
const serviceTargetGroupName = `${serviceName}tg`;
const serviceLoadBalancerName = `${serviceName}lb`;
const newServiceName = `${serviceName}replace`;
const securityGroup = `${prefix}${dbAlias}sg`;

// TODO: Improve timings for this test
jest.setTimeout(1800000);  // 30min timeout
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('ECS Integration Testing', () => {
  it('creates a new test db ECS', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${region}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('creates a new sidecar test db ECS', (done) => void iasql.connect(
    dbAliasSidecar,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', installSync(['aws_account']));

  it('inserts aws credentials', querySync(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${region}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the ecs module and its dependencies in sidecar db', sidecarInstall(modules));

  it('installs the ecs module and its dependencies', install(modules));

  // Cluster
  it('adds a new cluster', query(`
    INSERT INTO cluster (cluster_name)
    VALUES('${clusterName}');
  `));

  it('undo changes', sync());

  it('check cluster insertion', query(`
    SELECT *
    FROM cluster
    WHERE cluster_name = '${clusterName}';
  `, (res: any[]) => expect(res.length).toBe(0)));


  it('adds a new cluster', query(`
    INSERT INTO cluster (cluster_name)
    VALUES('${clusterName}');
  `));

  it('applies adds a new cluster', apply());

  it('check cluster insertion', query(`
    SELECT *
    FROM cluster
    WHERE cluster_name = '${clusterName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  // Service dependencies
  it('adds service dependencies', query(`
    BEGIN;
      INSERT INTO security_group
        (description, group_name)
      VALUES
        ('${securityGroup}', '${securityGroup}');
      INSERT INTO security_group_rule
        (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
      SELECT true, '-1', -1, -1, '0.0.0.0/0', '${securityGroup}', id
      FROM security_group
      WHERE group_name = '${securityGroup}';
      INSERT INTO target_group
          (target_group_name, target_type, protocol, port, vpc, health_check_path)
      VALUES
          ('${serviceTargetGroupName}', 'ip', 'HTTP', ${hostPort}, null, '/health');
      INSERT INTO load_balancer
          (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
      VALUES
          ('${serviceLoadBalancerName}', 'internet-facing', null, 'application', 'ipv4');
      INSERT INTO load_balancer_security_groups
          (load_balancer_name, security_group_id)
      VALUES
          ('${serviceLoadBalancerName}',
            (SELECT id FROM security_group WHERE group_name = '${securityGroup}' LIMIT 1));
      INSERT INTO listener
          (load_balancer_name, port, protocol, action_type, target_group_name)
      VALUES 
          ('${serviceLoadBalancerName}',
            ${hostPort}, 'HTTP', 'forward', '${serviceTargetGroupName}');
    COMMIT;
  `));

  it('applies service dependencies', apply());

  it('check target group insertion', query(`
    SELECT *
    FROM target_group
    WHERE target_group_name = '${serviceTargetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check target group insertion', query(`
    SELECT *
    FROM load_balancer
    WHERE load_balancer_name = '${serviceLoadBalancerName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  // Service spinning up a task definition with container using a docker image
  // Container definition
  it('adds container dependencies', query(`
    BEGIN;
      INSERT INTO log_group (log_group_name)
      VALUES ('${logGroupName}');
      INSERT INTO role (role_name, assume_role_policy_document, attached_policies_arns)
      VALUES ('${taskExecRoleName}', '${taskRolePolicyDoc}', array['${taskPolicyArn}']);
    COMMIT;
  `));

  it('applies adds container dependencies', apply());

  it('check target group insertion', query(`
    SELECT *
    FROM log_group
    WHERE log_group_name = '${logGroupName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check target group insertion', query(`
    SELECT *
    FROM role
    WHERE role_name = '${taskExecRoleName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  // Task definition
  it('adds a new task definition', query(`
    INSERT INTO task_definition ("family", task_role_name, execution_role_name, cpu_memory)
    VALUES ('${tdFamily}', '${taskExecRoleName}', '${taskExecRoleName}', '${tdCpuMem}');
  `));

  it('check task_definition insertion', query(`
    SELECT *
    FROM task_definition
    WHERE family = '${tdFamily}' AND status IS NULL;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('adds a new container definition', query(`
    BEGIN;
      INSERT INTO container_definition ("name", image, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id, log_group_name)
      VALUES('${containerName}', '${image}', ${containerEssential}, ${containerMemoryReservation}, ${hostPort}, ${containerPort}, '${protocol}', '{ "test": 2}', (select id from task_definition where family = '${tdFamily}' and status is null limit 1), '${logGroupName}');
      INSERT INTO container_definition ("name", image, tag, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id, log_group_name)
      VALUES('${containerNameTag}', '${image}', '${imageTag}', false, ${containerMemoryReservation}, ${hostPort + 1}, ${containerPort + 1}, '${protocol}', '{ "test": 2}', (select id from task_definition where family = '${tdFamily}' and status is null limit 1), '${logGroupName}');
      INSERT INTO container_definition ("name", image, digest, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id, log_group_name)
      VALUES('${containerNameDigest}', '${image}', '${imageDigest}', false, ${containerMemoryReservation}, ${hostPort + 2}, ${containerPort + 2}, '${protocol}', '{ "test": 2}', (select id from task_definition where family = '${tdFamily}' and status is null limit 1), '${logGroupName}');
    COMMIT;
  `));

  it('check container definition insertion', query(`
    SELECT *
    FROM container_definition
    WHERE name = '${containerName}' AND image = '${image}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check container definition insertion', query(`
    SELECT *
    FROM container_definition
    WHERE name = '${containerNameTag}' AND image = '${image}' AND tag = '${imageTag}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check container definition insertion', query(`
    SELECT *
    FROM container_definition
    WHERE name = '${containerNameDigest}' AND image = '${image}' AND digest = '${imageDigest}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies adds a new task definition with container definition', apply());

  it('check task_definition insertion', query(`
    SELECT *
    FROM task_definition
    WHERE family = '${tdFamily}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check container definition insertion', query(`
    SELECT *
    FROM container_definition
    WHERE name = '${containerName}' AND image = '${image}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check container definition insertion', query(`
    SELECT *
    FROM container_definition
    WHERE name = '${containerNameTag}' AND image = '${image}' AND tag = '${imageTag}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check container definition insertion', query(`
    SELECT *
    FROM container_definition
    WHERE name = '${containerNameDigest}' AND image = '${image}' AND digest = '${imageDigest}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  // Service
  it('adds a new service', query(`
    BEGIN;
      INSERT INTO service ("name", desired_count, subnets, assign_public_ip, cluster_name, task_definition_id, target_group_name)
      VALUES ('${serviceName}', ${serviceDesiredCount}, (select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true limit 3)), 'ENABLED', '${clusterName}', (select id from task_definition where family = '${tdFamily}' order by revision desc limit 1), '${serviceTargetGroupName}');

      INSERT INTO service_security_groups (service_name, security_group_id)
      VALUES ('${serviceName}', (select id from security_group where group_name = '${securityGroup}' limit 1));
    COMMIT;
  `));

  it('check service insertion', query(`
    SELECT *
    FROM service
    WHERE name = '${serviceName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check service_security_groups insertion', query(`
    SELECT *
    FROM service_security_groups
    WHERE service_name = '${serviceName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('tries to update a task definition', query(`
    WITH td AS (
      SELECT revision
      FROM task_definition
      WHERE family = '${tdFamily}' AND status = '${tdActive}'
      ORDER BY family, revision DESC
      LIMIT 1
    )
    UPDATE task_definition SET revision = 55 WHERE family = '${tdFamily}' AND revision IN (SELECT revision FROM td);
  `));
  
  it('applies tries to update a task definition field', apply());

  it('check service insertion', query(`
    SELECT *
    FROM service
    WHERE name = '${serviceName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check task_definition update', query(`
    SELECT *
    FROM task_definition
    WHERE family = '${tdFamily}' AND status = '${tdActive}';
  `, (res: any[]) => expect(res.length).toBe(2)));

  
  it('tries to update a service (update)', query(`
    UPDATE service SET desired_count = ${serviceDesiredCount + 1} WHERE name = '${serviceName}';
  `));

  it('applies tries to update a service (update)', apply());

  it('check service update', query(`
    SELECT *
    FROM service
    WHERE name = '${serviceName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('tries to update a service (restore)', query(`
    UPDATE service SET status = 'fake' WHERE name = '${serviceName}';
  `));

  it('applies tries to update a service (restore)', apply());

  it('check service update', query(`
    SELECT *
    FROM service
    WHERE name = '${serviceName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('tries to update a service (replace)', query(`
    UPDATE service SET name = '${newServiceName}' WHERE name = '${serviceName}';
  `));

  it('applies tries to update a service (replace)', apply());

  it('check service update', query(`
    SELECT *
    FROM service
    WHERE name = '${newServiceName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('tries to force update a service', query(`
    UPDATE service SET force_new_deployment = true WHERE name = '${newServiceName}';
  `));

  it('tries to force update a service', apply());

  it('check service update', query(`
    SELECT *
    FROM service
    WHERE name = '${newServiceName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check service new deployment', query(`
    SELECT *
    FROM service
    WHERE name = '${newServiceName}';
  `, (res: any[]) => expect(res[0]['force_new_deployment']).toBe(false)));

  it('sync sidecar database', sidecarSync());

  it('uninstalls the ecs module', uninstall(['aws_ecs_fargate']));

  it('installs the ecs module', install(
    ['aws_ecs_fargate']));

  it('deletes service', query(`
    BEGIN;
      delete from service_security_groups
      using service
      where name = '${newServiceName}';

      delete from service
      where name = '${newServiceName}';


    COMMIT;
  `));

  it('applies deletes service', apply());

  it('check service deletion', query(`
    SELECT *
    FROM service
    WHERE name = '${serviceName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes container definitons', query(`
    begin;
      delete from container_definition
      using task_definition
      where container_definition.task_definition_id = task_definition.id and task_definition.family = '${tdFamily}';

      delete from task_definition
      where family = '${tdFamily}';

      delete from role
      where role_name = '${taskExecRoleName}';

      delete from log_group
      where log_group_name = '${logGroupName}';
    commit;
  `));

  it('applies deletes tasks and container definitions', apply());

  it('sync sidecar database', sidecarSync());

  it('check role deletion', query(`
    SELECT *
    FROM role
    WHERE role_name = '${taskExecRoleName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check log group deletion', query(`
    SELECT *
    FROM log_group
    WHERE log_group_name = '${logGroupName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check task def deletion', query(`
    SELECT *
    FROM task_definition
    WHERE family = '${tdFamily}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('uninstalls the ecs module', uninstall(
    ['aws_ecs_fargate']));

  it('installs the ecs module', install(
    ['aws_ecs_fargate']));

  // deletes service dependencies
  it('deletes service dependencies', query(`
    BEGIN;
      DELETE FROM listener
      WHERE load_balancer_name = '${serviceLoadBalancerName}'
        and port = ${hostPort} and protocol = 'HTTP' and action_type = 'forward' 
        and target_group_name = '${serviceTargetGroupName}';

      DELETE FROM load_balancer_security_groups
      WHERE load_balancer_name = '${serviceLoadBalancerName}';
    
      DELETE FROM load_balancer
      WHERE load_balancer_name = '${serviceLoadBalancerName}';

      DELETE FROM target_group
      WHERE target_group_name = '${serviceTargetGroupName}';

      DELETE FROM security_group_rule
      USING security_group
      WHERE group_name = '${securityGroup}';

      DELETE FROM security_group
      WHERE group_name = '${securityGroup}';
    COMMIT;
  `));

  it('applies deletes service dependencies', apply());

  it('tries to update a cluster field (restore)', query(`
    UPDATE cluster SET cluster_status = 'fake' WHERE cluster_name = '${clusterName}';
  `));

  it('applies tries to update a cluster field (restore)', apply());

  it('tries to update cluster (replace)', query(`
    UPDATE cluster SET cluster_name = '${newClusterName}' WHERE cluster_name = '${clusterName}';
  `));

  it('applies tries to update cluster (replace)', apply());

  it('deletes the cluster', query(`
    delete from cluster
    where cluster_name = '${newClusterName}';
  `));

  it('applies deletes the cluster', apply());

  it('deletes the sidecar test db', (done) => void iasql
    .disconnect(dbAliasSidecar, 'not-needed')
    .then(...finish(done)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('ECS install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the ECS module', install(
    modules));

  it('uninstalls the ECS module', uninstall(
    modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    config.db.user,
    true).then(...finish(done)));

  it('uninstalls the ECS module', uninstall(
    ['aws_ecs_fargate']));

  it('installs the ECS module', install(
    ['aws_ecs_fargate']));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});