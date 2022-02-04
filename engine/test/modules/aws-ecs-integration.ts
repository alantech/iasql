import { LoadBalancerStateEnum } from '@aws-sdk/client-elastic-load-balancing-v2';
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
const tdInactive = TaskDefinitionStatus.INACTIVE;
const serviceDesiredCount = 1;
const serviceSchedulingStrategy = SchedulingStrategy.REPLICA;
const serviceLaunchType = LaunchType.FARGATE;

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

  // todo: test task definition update

  // Service
  // todo: add service load balancer relation
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
        WHERE cluster_name = '${clusterName}'
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
      )
      INSERT INTO service (name, cluster_id, task_definition_id, desired_count, launch_type, scheduling_strategy, aws_vpc_conf_id)
      SELECT '${serviceName}', (select id from cl), (select id from td), ${serviceDesiredCount}, '${serviceLaunchType}', '${serviceSchedulingStrategy}', (select id from avc);
    COMMIT;
  `));

  // todo: check inserts
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

  // todo: test service update

  // todo: delete service

  it('check service insertion', query(`
  SELECT *
  FROM cluster, aws_vpc_conf, task_definition
  ORDER BY aws_vpc_conf.id, task_definition.revision DESC;
`, (res: any[]) => {
  console.log('*************')
  console.dir({res},{depth:5})
  return expect(res.length).toBe(1)
}));

  // it('deletes task definitions', query(`
  //   DELETE FROM task_definition
  //   WHERE family = '${tdFamily}';
  // `));

  // it('applies deletes task definitions', apply);

  // it('deletes the cluster', query(`
  //   DELETE FROM cluster
  //   WHERE cluster_name = '${newClusterName}';
  // `));

  // it('applies deletes the cluster', apply);

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
