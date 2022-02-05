import { CompatibilityValues, CpuMemCombination, LaunchType, NetworkMode, SchedulingStrategy, TaskDefinitionStatus } from '../../src/modules/aws_ecs/entity';
import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, finish, execComposeUp, execComposeDown, } from '../helpers'

jest.setTimeout(240000);

beforeAll(execComposeUp);

afterAll(execComposeDown);

const prefix = getPrefix();
const dbAlias = 'ecstest';
const apply = runApply.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);

// Test constants
const serviceName = `${prefix}${dbAlias}service`;
const clusterName = `${prefix}${dbAlias}cluster`;
const newClusterName = `${prefix}${dbAlias}clusternew`;
const logGroupName = `${prefix}${dbAlias}loggroup`;
const containerName = `${prefix}${dbAlias}container`;
const image = 'redis';
const imageTag = 'latest';
const containerMemoryReservation = 8192;  // MiB
const containerEssential = true;
const containerPort = 6379;
const hostPort = 6379;
const protocol = 'tcp';
const tdFamily = `${prefix}${dbAlias}td`;
const taskExecRole = 'arn:aws:iam::257682470237:role/ecsTaskExecutionRole';
const tdNetworkMode = NetworkMode.AWSVPC;
const tdCpuMem = CpuMemCombination['2vCPU-8GB'];
const tdCompatibility = CompatibilityValues.FARGATE;
const tdActive = TaskDefinitionStatus.ACTIVE;
const serviceDesiredCount = 1;
const serviceSchedulingStrategy = SchedulingStrategy.REPLICA;
const serviceLaunchType = LaunchType.FARGATE;
const serviceTargetGroupName = `${serviceName}tg`;
const serviceLoadBalancerName = `${serviceName}lb`;
const newServiceName = `${serviceName}replace`;

describe('ECS Integration Testing', () => {
  it('creates a new test db ECS', (done) => void iasql.add(
    dbAlias,
    'us-west-2',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the ecs module and its dependencies', (done) => void iasql.install(
    ['aws_ecr', 'aws_elb', 'aws_security_group', 'aws_cloudwatch', 'aws_ecs',],
    dbAlias,
    'not-needed').then(...finish(done)));

  // TODO: add tests with stored procedures
  // Cluster
  it('adds a new cluster', query(`
    INSERT INTO cluster (cluster_name)
    VALUES ('${clusterName}');
  `));

  it('check cluster insertion', query(`
    SELECT *
    FROM cluster
    WHERE cluster_name = '${clusterName}'
    ORDER BY id DESC
    LIMIT 1;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies adds a new cluster', apply);

  it('tries to update a cluster field (restore)', query(`
    UPDATE cluster SET cluster_status = 'fake' WHERE cluster_name = '${clusterName}';
  `));

  it('applies tries to update a cluster field (restore)', apply);

  it('tries to update a target group field (replace)', query(`
    UPDATE cluster SET cluster_name = '${newClusterName}' WHERE cluster_name = '${clusterName}';
  `));

  it('applies tries to update a target group field (replace)', apply);

  // Dependency
  it('adds container dependencies', query(`
    CALL create_cloudwatch_log_group('${logGroupName}');
  `));

  it('applies adds container dependencies', apply);

  // Task definition
  it('adds a new task definition', query(`
    BEGIN;
      INSERT INTO task_definition (family, revision, task_role_arn, execution_role_arn, network_mode, cpu_memory)
      VALUES ('${tdFamily}', 1, '${taskExecRole}', '${taskExecRole}', '${tdNetworkMode}', '${tdCpuMem}');

      INSERT INTO compatibility (name)
      VALUES ('${tdCompatibility}')
      ON CONFLICT (name)
      DO NOTHING;

      INSERT INTO task_definition_req_compatibilities_compatibility (task_definition_id, compatibility_id)
      SELECT task_definition.id, compatibility.id
      FROM task_definition, compatibility
      WHERE task_definition.family = '${tdFamily}' AND task_definition.status IS NULL AND compatibility.name = '${tdCompatibility}'
      ORDER BY task_definition.family, task_definition.revision DESC;
    COMMIT;
  `));

  it('check task_definition insertion', query(`
    SELECT *
    FROM task_definition
    WHERE family = '${tdFamily}' AND status IS NULL;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check task_definition_req_compatibilities_compatibility insertion', query(`
    SELECT *
    FROM task_definition_req_compatibilities_compatibility
    INNER JOIN task_definition ON task_definition.id = task_definition_req_compatibilities_compatibility.task_definition_id
    WHERE task_definition.family = '${tdFamily}' AND status IS NULL;
  `, (res: any[]) => expect(res.length).toBe(1)));

  // Container definition
  it('adds a new container definition', query(`
    BEGIN;
      INSERT INTO container_definition (name, docker_image, tag, essential, memory_reservation, log_group_id)
      SELECT '${containerName}', '${image}', '${imageTag}', ${containerEssential}, ${containerMemoryReservation}, id
      FROM log_group
      WHERE log_group_name = '${logGroupName}';

      INSERT INTO port_mapping (container_port, host_port, protocol)
      VALUES ('${containerPort}', '${hostPort}', '${protocol}');

      INSERT INTO container_definition_port_mappings_port_mapping (container_definition_id, port_mapping_id)
      SELECT container_definition.id, port_mapping.id
      FROM container_definition, port_mapping
      WHERE port_mapping.container_port = '${containerPort}' AND port_mapping.host_port = '${hostPort}' AND port_mapping.protocol = '${protocol}'
        AND container_definition.name = '${containerName}' AND container_definition.docker_image = '${image}' AND container_definition.tag = '${imageTag}'
      LIMIT 1;

      INSERT INTO task_definition_containers_container_definition (task_definition_id, container_definition_id)
      SELECT task_definition.id, container_definition.id
      FROM container_definition, task_definition
      WHERE container_definition.name = '${containerName}' AND container_definition.docker_image = '${image}' AND container_definition.tag = '${imageTag}'
        AND task_definition.family = '${tdFamily}' AND task_definition.status IS NULL
      LIMIT 1;

    COMMIT;
  `));

  it('check container definition insertion', query(`
    SELECT *
    FROM container_definition
    WHERE name = '${containerName}' AND docker_image = '${image}' AND tag = '${imageTag}';
  `, (res: any[]) => expect(res.length).toBe(1)));


  it('check container_definition_port_mappings_port_mapping insertion', query(`
    SELECT *
    FROM container_definition_port_mappings_port_mapping
    INNER JOIN container_definition ON container_definition.id = container_definition_port_mappings_port_mapping.container_definition_id
    INNER JOIN port_mapping ON port_mapping.id = container_definition_port_mappings_port_mapping.port_mapping_id
    WHERE port_mapping.container_port = '${containerPort}' AND port_mapping.host_port = '${hostPort}' AND port_mapping.protocol = '${protocol}'
      AND container_definition.name = '${containerName}' AND container_definition.docker_image = '${image}' AND container_definition.tag = '${imageTag}';
  `, (res: any[]) => expect(res.length).toBeGreaterThan(0)));

  it('check task_definition_containers_container_definition insertion', query(`
    SELECT *
    FROM task_definition_containers_container_definition
    INNER JOIN container_definition ON container_definition.id = task_definition_containers_container_definition.container_definition_id
    INNER JOIN task_definition ON task_definition.id = task_definition_containers_container_definition.task_definition_id
    WHERE container_definition.name = '${containerName}' AND container_definition.docker_image = '${image}' AND container_definition.tag = '${imageTag}'
      AND task_definition.family = '${tdFamily}' AND task_definition.status IS NULL;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies adds a new task definition with container definition', apply);

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

  it('applies tries to update a task definition field', apply);

  // Service dependency
  it('adds service dependencies', query(`
    BEGIN;
      DO
      $$
      DECLARE default_vpc text;
      BEGIN
          SELECT vpc_id into default_vpc
          FROM aws_vpc
          WHERE is_default = true
          LIMIT 1;
          CALL create_aws_target_group('${serviceTargetGroupName}', 'ip', ${hostPort}, default_vpc, 'HTTP', '/health');
      END
      $$;

      DO
      $$
      DECLARE default_vpc text;
              default_vpc_id integer;
              subnets text[];
      BEGIN
          SELECT vpc_id, id INTO default_vpc, default_vpc_id
          FROM aws_vpc
          WHERE is_default = true
          LIMIT 1;

          SELECT ARRAY(
            SELECT subnet_id
            FROM aws_subnet
            WHERE vpc_id = default_vpc_id) INTO subnets;

          CALL create_aws_load_balancer(
            '${serviceLoadBalancerName}', 'internet-facing', default_vpc, 'application', subnets, 'ipv4', array['default']
          );
      END
      $$;

      CALL create_aws_listener('${serviceLoadBalancerName}', ${hostPort}, 'HTTP', 'forward', '${serviceTargetGroupName}');
    COMMIT;
  `));

  it('applies service dependencies', apply);

  // Service
  it('adds a new service', query(`
    BEGIN;
      INSERT INTO aws_vpc_conf (assign_public_ip)
      VALUES ('ENABLED');

      INSERT INTO aws_vpc_conf_subnets_aws_subnet (aws_vpc_conf_id, aws_subnet_id)
      SELECT aws_vpc_conf.id, aws_subnet.id
      FROM aws_vpc_conf, aws_subnet
      INNER JOIN aws_vpc ON aws_vpc.id = aws_subnet.vpc_id
      WHERE aws_vpc.is_default = true
      ORDER BY aws_vpc_conf.id, aws_subnet.id DESC
      LIMIT 1;

      INSERT INTO aws_vpc_conf_security_groups_aws_security_group (aws_vpc_conf_id, aws_security_group_id)
      SELECT aws_vpc_conf.id, aws_security_group.id
      FROM aws_vpc_conf, aws_security_group
      WHERE aws_security_group.group_name = 'default'
      ORDER BY aws_vpc_conf.id, aws_security_group.id DESC
      LIMIT 1;

      WITH cl AS (
        SELECT id
        FROM cluster
        WHERE cluster_name = '${newClusterName}'
      ), avc AS (
        SELECT id
        FROM aws_vpc_conf
        ORDER BY id DESC
        LIMIT 1
      ), td AS (
        SELECT id
        FROM task_definition
        WHERE family = '${tdFamily}' AND status = '${tdActive}'
        ORDER BY revision DESC
        LIMIT 1
      )
      INSERT INTO service (name, cluster_id, task_definition_id, desired_count, launch_type, scheduling_strategy, aws_vpc_conf_id)
      SELECT '${serviceName}', (select id from cl), (select id from td), ${serviceDesiredCount}, '${serviceLaunchType}', '${serviceSchedulingStrategy}', (select id from avc);

      WITH c AS (
        SELECT container_definition.name as name
        FROM container_definition
        INNER JOIN task_definition_containers_container_definition ON container_definition.id = task_definition_containers_container_definition.container_definition_id
        INNER JOIN task_definition ON task_definition_containers_container_definition.task_definition_id = task_definition.id
        WHERE task_definition.family = '${tdFamily}' AND task_definition.status = '${tdActive}'
        ORDER BY task_definition.family, task_definition.revision DESC
        LIMIT 1
      ), tg AS (
        SELECT id
        FROM aws_target_group
        WHERE target_group_name = '${serviceTargetGroupName}'
        LIMIT 1
      )
      INSERT INTO service_load_balancer (container_name, container_port, target_group_id, elb_id)
      SELECT (select name from c), ${hostPort}, (select id from tg), null; -- insert either target group or load balancer

      WITH s AS (
        SELECT id
        FROM service
        WHERE name = '${serviceName}'
      ), slb AS (
        SELECT id
        FROM service_load_balancer
        ORDER BY id DESC
        LIMIT 1
      )
      INSERT INTO service_load_balancers_service_load_balancer (service_id, service_load_balancer_id)
      SELECT (SELECT id FROM s), (select id from slb);
    COMMIT;
  `));

  it('check aws_vpc_conf insertion', query(`
    SELECT *
    FROM aws_vpc_conf;
  `, (res: any[]) => expect(res.length).toBeGreaterThan(0)));

  it('check aws_vpc_conf_subnets_aws_subnet insertion', query(`
    SELECT *
    FROM aws_vpc_conf_subnets_aws_subnet
    INNER JOIN aws_subnet ON aws_subnet.id = aws_vpc_conf_subnets_aws_subnet.aws_subnet_id
    INNER JOIN aws_vpc ON aws_vpc.id = aws_subnet.vpc_id
    WHERE aws_vpc.is_default = true
    LIMIT 1;
  `, (res: any[]) => expect(res.length).toBeGreaterThan(0)));

  it('check aws_vpc_conf_security_groups_aws_security_group insertion', query(`
    SELECT *
    FROM aws_vpc_conf_security_groups_aws_security_group
    INNER JOIN aws_security_group ON aws_security_group.id = aws_vpc_conf_security_groups_aws_security_group.aws_security_group_id
    WHERE aws_security_group.group_name = 'default'
    LIMIT 1;
  `, (res: any[]) => expect(res.length).toBeGreaterThan(0)));

  it('check service insertion', query(`
    SELECT *
    FROM service
    WHERE name = '${serviceName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check service_load_balancer insertion', query(`
    SELECT *
    FROM service_load_balancers_service_load_balancer
    INNER JOIN service_load_balancer ON service_load_balancer.id = service_load_balancers_service_load_balancer.service_load_balancer_id
    INNER JOIN service ON service.id = service_load_balancers_service_load_balancer.service_id
    INNER JOIN aws_target_group ON aws_target_group.id = service_load_balancer.target_group_id
    WHERE service.name = '${serviceName}' AND aws_target_group.target_group_name = '${serviceTargetGroupName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('tries to update a service (update)', query(`
    UPDATE service SET desired_count = ${serviceDesiredCount + 1} WHERE name = '${serviceName}';
  `));

  it('applies tries to update a service (update)', apply);

  it('tries to update a service (restore)', query(`
    UPDATE service SET status = 'fake' WHERE name = '${serviceName}';
  `));

  it('applies tries to update a service (restore)', apply);

  it('tries to update a service (replace)', query(`
    UPDATE service SET name = '${newServiceName}' WHERE name = '${serviceName}';
  `));

  it('applies tries to update a service (replace)', apply);

  it('deletes service', query(`
    DELETE FROM service_load_balancers_service_load_balancer
    INNER JOIN service_load_balancer ON service_load_balancer.id = service_load_balancers_service_load_balancer.service_load_balancer_id
    INNER JOIN service ON service.id = service_load_balancers_service_load_balancer.service_id
    INNER JOIN aws_target_group ON aws_target_group.id = service_load_balancer.target_group_id
    WHERE service.name = '${serviceName}' AND aws_target_group.target_group_name = '${serviceTargetGroupName}';

    DELETE FROM service
    WHERE name = '${newServiceName}';
  `));

  it('applies deletes service', apply);

  it('deletes task definitions', query(`
    DELETE FROM task_definition
    WHERE family = '${tdFamily}';
  `));

  it('applies deletes task definitions', apply);

  it('deletes the cluster', query(`
    DELETE FROM cluster
    WHERE cluster_name = '${newClusterName}';
  `));

  it('applies deletes the cluster', apply);

  it('deletes dependencies',  query(`
    DELETE FROM aws_action
    WHERE id IN (
      SELECT aws_action_id
      FROM aws_listener_default_actions_aws_action
      WHERE aws_listener_id IN (
        SELECT aws_listener.id
        FROM aws_listener
        INNER JOIN aws_load_balancer ON aws_load_balancer.id = aws_listener.aws_load_balancer_id
        WHERE load_balancer_name = '${serviceLoadBalancerName}'
        ORDER BY aws_listener.id DESC
        LIMIT 1
      )
    );
    DELETE FROM aws_listener
    WHERE id IN (
      SELECT aws_listener.id
      FROM aws_listener
      INNER JOIN aws_load_balancer ON aws_load_balancer.id = aws_listener.aws_load_balancer_id
      WHERE load_balancer_name = '${serviceLoadBalancerName}'
      ORDER BY aws_listener.id DESC
      LIMIT 1
    );

    DELETE FROM aws_load_balancer
    WHERE load_balancer_name = '${serviceLoadBalancerName}';

    DELETE FROM aws_target_group
    WHERE target_group_name = '${serviceTargetGroupName}';
  `));

  it('applies deletes dependencies', apply);

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
