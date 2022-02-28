import { CompatibilityValues, CpuMemCombination, LaunchType, NetworkMode, SchedulingStrategy, TaskDefinitionStatus } from '../../src/modules/aws_ecs@0.0.1/entity';
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
const serviceRepositoryName = `${prefix}${dbAlias}servicerepository`;
const servicePublicRepositoryName = `${prefix}${dbAlias}servicepublicrepository`;
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
const tdRepositoryFamily = `${prefix}${dbAlias}tdrepository`;
const tdPublicRepositoryFamily = `${prefix}${dbAlias}tdpublicrepository`;
const taskExecRole = 'arn:aws:iam::852372565011:role/ecsTaskExecutionRole';
const tdNetworkMode = NetworkMode.AWSVPC;
const tdCpuMem = CpuMemCombination['2vCPU-8GB'];
const tdCompatibility = CompatibilityValues.FARGATE;
const tdActive = TaskDefinitionStatus.ACTIVE;
const serviceDesiredCount = 1;
const serviceSchedulingStrategy = SchedulingStrategy.REPLICA;
const serviceLaunchType = LaunchType.FARGATE;
const serviceTargetGroupName = `${serviceName}tg`;
const serviceRepoTargetGroupName = `${serviceName}tgr`;
const servicePubRepoTargetGroupName = `${serviceName}tgpr`;
const serviceLoadBalancerName = `${serviceName}lb`;
const serviceRepoLoadBalancerName = `${serviceName}lbr`;
const servicePubRepoLoadBalancerName = `${serviceName}lbpr`;
const newServiceName = `${serviceName}replace`;
const newServiceRepositoryName = `${serviceRepositoryName}replace`;
const newServicePublicRepositoryName = `${servicePublicRepositoryName}replace`;
const repositoryName = `${prefix}${dbAlias}repository`;
const containerNameRepository = `${prefix}${dbAlias}containerrepository`;
const publicRepositoryName = `${prefix}${dbAlias}publicrepository`;
const containerNamePublicRepository = `${prefix}${dbAlias}containerpublicrepository`;

describe('ECS Integration Testing SP', () => {
  it('creates a new test db ECS', (done) => void iasql.add(
    dbAlias,
    'us-west-2',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the ecs module and its dependencies', (done) => void iasql.install(
    ['aws_ecr@0.0.1', 'aws_elb@0.0.1', 'aws_security_group@0.0.1', 'aws_cloudwatch@0.0.1', 'aws_ecs@0.0.1',],
    dbAlias,
    'not-needed').then(...finish(done)));

  // TODO: add tests with stored procedures
  // Cluster
  it('adds a new cluster', query(`
    call create_or_update_ecs_cluster('${clusterName}');
  `));

  it('check cluster insertion', query(`
    SELECT *
    FROM cluster
    WHERE cluster_name = '${clusterName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies adds a new cluster', apply);

  it('adds container dependencies', query(`
    CALL create_or_update_cloudwatch_log_group('${logGroupName}');
  `));

  it('applies adds container dependencies', apply);

  // Service spinning up a task definition with container using a docker image
  describe('Docker image', () => {
    // Task definition
    it('adds a new task definition', query(`
      call create_task_definition('${tdFamily}', '${taskExecRole}', '${taskExecRole}', '${tdNetworkMode}', array['${tdCompatibility}']::compatibility_name_enum[], '${tdCpuMem}');
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
      call create_container_definition('${tdFamily}', '${containerName}', ${containerEssential}, ${containerMemoryReservation}, ${hostPort}, ${containerPort}, '${protocol}', null, '${imageTag}', _docker_image := '${image}', _cloud_watch_log_group := '${logGroupName}');
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

    // Service dependency
    it('adds service dependencies', query(`
      call create_or_update_aws_target_group('${serviceTargetGroupName}', 'ip', ${hostPort}, 'default', 'HTTP', '/health');
      call create_or_update_aws_load_balancer('${serviceLoadBalancerName}', 'internet-facing', 'default', 'application', 'ipv4');
      call create_or_update_aws_listener('${serviceLoadBalancerName}', ${hostPort}, 'HTTP', 'forward', '${serviceTargetGroupName}');
    `));

    it('applies service dependencies', apply);

    // Service
    it('adds a new service', query(`
      call create_or_update_ecs_service('${serviceName}', '${clusterName}', '${tdFamily}', ${serviceDesiredCount}, '${serviceLaunchType}', '${serviceSchedulingStrategy}', array['default'], 'ENABLED', _target_group_name := '${serviceTargetGroupName}');
    `));

    it('check aws_vpc_conf insertion', query(`
      SELECT *
      FROM aws_vpc_conf;
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
    
    it('check task_definition update', query(`
      SELECT *
      FROM task_definition
      WHERE family = '${tdFamily}' AND status = '${tdActive}';
    `, (res: any[]) => expect(res.length).toBe(2)));

    
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
      call delete_ecs_service('${newServiceName}');
    `));

    it('applies deletes service', apply);

    // deletes service dependencies
    it('deletes service dependencies', query(`
      call delete_aws_listener('${serviceLoadBalancerName}', ${hostPort}, 'HTTP', 'forward', '${serviceTargetGroupName}');
      call delete_aws_load_balancer('${serviceLoadBalancerName}');
      call delete_aws_target_group('${serviceTargetGroupName}');
    `));

    it('applies deletes service dependencies', apply);
    
    it('deletes container definitons', query(`
      call delete_container_definition('${containerName}', '${tdFamily}');
      call delete_cloudwatch_log_group('${logGroupName}');
      call delete_task_definition('${tdFamily}');
    `));

    it('applies deletes tasks and container definitions', apply);
  });

  // Service spinning up a task definition with container using a private ecr
  describe('Private ECR', () => {
    // ECR
    it('adds a new ECR', query(`
      CALL create_or_update_ecr_repository('${repositoryName}');
    `));

    it('check aws_repository insertion', query(`
      SELECT *
      FROM aws_repository
      WHERE repository_name = '${repositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    // Task definition
    it('adds a new task definition', query(`
      call create_task_definition('${tdRepositoryFamily}', '${taskExecRole}', '${taskExecRole}', '${tdNetworkMode}', array['${tdCompatibility}']::compatibility_name_enum[], '${tdCpuMem}');
    `));

    it('check task_definition insertion', query(`
      SELECT *
      FROM task_definition
      WHERE family = '${tdRepositoryFamily}' AND status IS NULL;
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('check task_definition_req_compatibilities_compatibility insertion', query(`
      SELECT *
      FROM task_definition_req_compatibilities_compatibility
      INNER JOIN task_definition ON task_definition.id = task_definition_req_compatibilities_compatibility.task_definition_id
      WHERE task_definition.family = '${tdRepositoryFamily}' AND status IS NULL;
    `, (res: any[]) => expect(res.length).toBe(1)));

    // Container definition
    it('adds a new container definition', query(`
      call create_container_definition('${tdRepositoryFamily}', '${containerNameRepository}', ${containerEssential}, ${containerMemoryReservation}, ${hostPort}, ${containerPort}, '${protocol}', null, '${imageTag}', _ecr_repository_name := '${repositoryName}');
    `));

    it('check container definition insertion', query(`
      SELECT *
      FROM container_definition
      INNER JOIN aws_repository ON aws_repository.id = repository_id
      WHERE name = '${containerNameRepository}' AND repository_name = '${repositoryName}' AND tag = '${imageTag}';
    `, (res: any[]) => expect(res.length).toBe(1)));


    it('check container_definition_port_mappings_port_mapping insertion', query(`
      SELECT *
      FROM container_definition_port_mappings_port_mapping
      INNER JOIN container_definition ON container_definition.id = container_definition_port_mappings_port_mapping.container_definition_id
      INNER JOIN port_mapping ON port_mapping.id = container_definition_port_mappings_port_mapping.port_mapping_id
      INNER JOIN aws_repository ON aws_repository.id = container_definition.repository_id
      WHERE port_mapping.container_port = '${containerPort}' AND port_mapping.host_port = '${hostPort}' AND port_mapping.protocol = '${protocol}'
        AND container_definition.name = '${containerNameRepository}' AND aws_repository.repository_name = '${repositoryName}' AND container_definition.tag = '${imageTag}';
    `, (res: any[]) => expect(res.length).toBeGreaterThan(0)));

    it('check task_definition_containers_container_definition insertion', query(`
      SELECT *
      FROM task_definition_containers_container_definition
      INNER JOIN container_definition ON container_definition.id = task_definition_containers_container_definition.container_definition_id
      INNER JOIN task_definition ON task_definition.id = task_definition_containers_container_definition.task_definition_id
      INNER JOIN aws_repository ON aws_repository.id = container_definition.repository_id
      WHERE container_definition.name = '${containerNameRepository}' AND aws_repository.repository_name = '${repositoryName}' AND container_definition.tag = '${imageTag}'
        AND task_definition.family = '${tdRepositoryFamily}' AND task_definition.status IS NULL;
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('applies adds a new task definition with container definition', apply);

    // Service dependency
    it('adds service dependencies', query(`
      call create_or_update_aws_target_group('${serviceRepoTargetGroupName}', 'ip', ${hostPort}, 'default', 'HTTP', '/health');
      call create_or_update_aws_load_balancer('${serviceRepoLoadBalancerName}', 'internet-facing', 'default', 'application', 'ipv4');
      call create_or_update_aws_listener('${serviceRepoLoadBalancerName}', ${hostPort}, 'HTTP', 'forward', '${serviceRepoTargetGroupName}');
    `));

    it('applies service dependencies', apply);

    // Service
    it('adds a new service', query(`
      call create_or_update_ecs_service('${serviceRepositoryName}', '${clusterName}', '${tdRepositoryFamily}', ${serviceDesiredCount}, '${serviceLaunchType}', '${serviceSchedulingStrategy}', array['default'], 'ENABLED', _target_group_name := '${serviceRepoTargetGroupName}');
    `));

    it('check aws_vpc_conf insertion', query(`
      SELECT *
      FROM aws_vpc_conf;
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
      WHERE name = '${serviceRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('check service_load_balancer insertion', query(`
      SELECT *
      FROM service_load_balancers_service_load_balancer
      INNER JOIN service_load_balancer ON service_load_balancer.id = service_load_balancers_service_load_balancer.service_load_balancer_id
      INNER JOIN service ON service.id = service_load_balancers_service_load_balancer.service_id
      INNER JOIN aws_target_group ON aws_target_group.id = service_load_balancer.target_group_id
      WHERE service.name = '${serviceRepositoryName}' AND aws_target_group.target_group_name = '${serviceRepoTargetGroupName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('deletes service', query(`
      call delete_ecs_service('${serviceRepositoryName}');
    `));

    it('applies deletes service', apply);

    // deletes service dependencies
    it('deletes service dependencies', query(`
      call delete_aws_listener('${serviceRepoLoadBalancerName}', ${hostPort}, 'HTTP', 'forward', '${serviceRepoTargetGroupName}');
      call delete_aws_load_balancer('${serviceRepoLoadBalancerName}');
      call delete_aws_target_group('${serviceRepoTargetGroupName}');
    `));

    it('applies deletes service dependencies', apply);
    
    it('deletes container definitons', query(`
      call delete_container_definition('${containerNameRepository}', '${tdRepositoryFamily}');
      call delete_ecr_repository('${repositoryName}');
      call delete_task_definition('${tdRepositoryFamily}');
    `));

    it('applies deletes task  and container definitions', apply);
  });

  // Service spinning up a task definition with container using a public ecr
  describe('Public ECR', () => {
    // ECR
    it('adds a new public ECR', query(`
      CALL create_or_update_ecr_public_repository('${publicRepositoryName}');
    `));

    it('check aws_public_repository insertion', query(`
      SELECT *
      FROM aws_public_repository
      WHERE repository_name = '${publicRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    // Task definition
    it('adds a new task definition', query(`
      call create_task_definition('${tdPublicRepositoryFamily}', '${taskExecRole}', '${taskExecRole}', '${tdNetworkMode}', array['${tdCompatibility}']::compatibility_name_enum[], '${tdCpuMem}');
    `));

    it('check task_definition insertion', query(`
      SELECT *
      FROM task_definition
      WHERE family = '${tdPublicRepositoryFamily}' AND status IS NULL;
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('check task_definition_req_compatibilities_compatibility insertion', query(`
      SELECT *
      FROM task_definition_req_compatibilities_compatibility
      INNER JOIN task_definition ON task_definition.id = task_definition_req_compatibilities_compatibility.task_definition_id
      WHERE task_definition.family = '${tdPublicRepositoryFamily}' AND status IS NULL;
    `, (res: any[]) => expect(res.length).toBe(1)));

    // Container definition
    it('adds a new container definition', query(`
      call create_container_definition('${tdPublicRepositoryFamily}', '${containerNamePublicRepository}', ${containerEssential}, ${containerMemoryReservation}, ${hostPort}, ${containerPort}, '${protocol}', null, '${imageTag}', _ecr_public_repository_name := '${publicRepositoryName}');
    `));

    it('check container definition insertion', query(`
      SELECT *
      FROM container_definition
      INNER JOIN aws_public_repository ON aws_public_repository.id = public_repository_id
      WHERE name = '${containerNamePublicRepository}' AND repository_name = '${publicRepositoryName}' AND tag = '${imageTag}';
    `, (res: any[]) => expect(res.length).toBe(1)));


    it('check container_definition_port_mappings_port_mapping insertion', query(`
      SELECT *
      FROM container_definition_port_mappings_port_mapping
      INNER JOIN container_definition ON container_definition.id = container_definition_port_mappings_port_mapping.container_definition_id
      INNER JOIN port_mapping ON port_mapping.id = container_definition_port_mappings_port_mapping.port_mapping_id
      INNER JOIN aws_public_repository ON aws_public_repository.id = container_definition.public_repository_id
      WHERE port_mapping.container_port = '${containerPort}' AND port_mapping.host_port = '${hostPort}' AND port_mapping.protocol = '${protocol}'
        AND container_definition.name = '${containerNamePublicRepository}' AND aws_public_repository.repository_name = '${publicRepositoryName}' AND container_definition.tag = '${imageTag}';
    `, (res: any[]) => expect(res.length).toBeGreaterThan(0)));

    it('check task_definition_containers_container_definition insertion', query(`
      SELECT *
      FROM task_definition_containers_container_definition
      INNER JOIN container_definition ON container_definition.id = task_definition_containers_container_definition.container_definition_id
      INNER JOIN task_definition ON task_definition.id = task_definition_containers_container_definition.task_definition_id
      INNER JOIN aws_public_repository ON aws_public_repository.id = container_definition.public_repository_id
      WHERE container_definition.name = '${containerNamePublicRepository}' AND aws_public_repository.repository_name = '${publicRepositoryName}' AND container_definition.tag = '${imageTag}'
        AND task_definition.family = '${tdPublicRepositoryFamily}' AND task_definition.status IS NULL;
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('applies adds a new task definition with container definition', apply);

    // Service dependency
    it('adds service dependencies', query(`
      call create_or_update_aws_target_group('${servicePubRepoTargetGroupName}', 'ip', ${hostPort}, 'default', 'HTTP', '/health');
      call create_or_update_aws_load_balancer('${servicePubRepoLoadBalancerName}', 'internet-facing', 'default', 'application', 'ipv4');
      call create_or_update_aws_listener('${servicePubRepoLoadBalancerName}', ${hostPort}, 'HTTP', 'forward', '${servicePubRepoTargetGroupName}');
    `));

    it('applies service dependencies', apply);

    // Service
    it('adds a new service', query(`
      call create_or_update_ecs_service('${serviceRepositoryName}', '${clusterName}', '${tdPublicRepositoryFamily}', ${serviceDesiredCount}, '${serviceLaunchType}', '${serviceSchedulingStrategy}', array['default'], 'ENABLED', _target_group_name := '${servicePubRepoTargetGroupName}');
    `));

    it('check aws_vpc_conf insertion', query(`
      SELECT *
      FROM aws_vpc_conf;
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
      WHERE name = '${serviceRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('check service_load_balancer insertion', query(`
      SELECT *
      FROM service_load_balancers_service_load_balancer
      INNER JOIN service_load_balancer ON service_load_balancer.id = service_load_balancers_service_load_balancer.service_load_balancer_id
      INNER JOIN service ON service.id = service_load_balancers_service_load_balancer.service_id
      INNER JOIN aws_target_group ON aws_target_group.id = service_load_balancer.target_group_id
      WHERE service.name = '${serviceRepositoryName}' AND aws_target_group.target_group_name = '${servicePubRepoTargetGroupName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('deletes service', query(`
      call delete_ecs_service('${serviceRepositoryName}');
    `));

    it('applies deletes service', apply);

    // deletes service dependencies
    it('deletes service dependencies', query(`
      call delete_aws_listener('${servicePubRepoLoadBalancerName}', ${hostPort}, 'HTTP', 'forward', '${servicePubRepoTargetGroupName}');
      call delete_aws_load_balancer('${servicePubRepoLoadBalancerName}');
      call delete_aws_target_group('${servicePubRepoTargetGroupName}');
    `));

    it('applies deletes service dependencies', apply);
    
    it('deletes container definitons', query(`
      call delete_container_definition('${containerNamePublicRepository}', '${tdPublicRepositoryFamily}');
      call delete_ecr_public_repository('${publicRepositoryName}');
      call delete_task_definition('${tdPublicRepositoryFamily}');
    `));

    it('applies deletes tasks and container definitions', apply);
  });

  it('tries to update a cluster field (restore)', query(`
    UPDATE cluster SET cluster_status = 'fake' WHERE cluster_name = '${clusterName}';
  `));

  it('applies tries to update a cluster field (restore)', apply);

  it('tries to update a target group field (replace)', query(`
    UPDATE cluster SET cluster_name = '${newClusterName}' WHERE cluster_name = '${clusterName}';
  `));

  it('applies tries to update a target group field (replace)', apply);

  it('deletes the cluster', query(`
    call delete_ecs_cluster('${newClusterName}');
  `));

  it('applies deletes the cluster', apply);

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
