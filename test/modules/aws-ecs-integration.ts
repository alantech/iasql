import { CpuMemCombination, TaskDefinitionStatus } from '../../src/modules/aws_ecs_fargate@0.0.1/entity';
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
const servicePublicRepositoryName = `${prefix}${dbAlias}servpubrep`;
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
const tdRepositoryFamily = `${prefix}${dbAlias}tdrepository`;
const tdPublicRepositoryFamily = `${prefix}${dbAlias}tdpublicrepository`;
const taskExecRole = 'arn:aws:iam::852372565011:role/ecsTaskExecutionRole';
const tdCpuMem = CpuMemCombination['2vCPU-8GB'];
const tdActive = TaskDefinitionStatus.ACTIVE;
const serviceDesiredCount = 1;
const serviceTargetGroupName = `${serviceName}tg`;
const serviceLoadBalancerName = `${serviceName}lb`;
const newServiceName = `${serviceName}replace`;
const repositoryName = `${prefix}${dbAlias}repository`;
const containerNameRepository = `${prefix}${dbAlias}containerrepository`;
const publicRepositoryName = `${prefix}${dbAlias}publicrepository`;
const containerNamePublicRepository = `${prefix}${dbAlias}containerpublicrepository`;

describe('ECS Integration Testing', () => {
  it('creates a new test db ECS', (done) => void iasql.add(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the ecs module and its dependencies', (done) => void iasql.install(
    ['aws_ecr@0.0.1', 'aws_elb@0.0.1', 'aws_security_group@0.0.1', 'aws_cloudwatch@0.0.1', 'aws_ecs_fargate@0.0.1', 'aws_vpc@0.0.1',],
    dbAlias,
    'not-needed').then(...finish(done)));

  // Cluster
  it('adds a new aws_cluster', query(`
    INSERT INTO aws_cluster (cluster_name)
    VALUES('${clusterName}');
  `));

  it('check aws_cluster insertion', query(`
    SELECT *
    FROM aws_cluster
    WHERE cluster_name = '${clusterName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies adds a new aws_cluster', apply);

  // Service dependencies
  it('adds aws_service dependencies', query(`
    BEGIN;
      INSERT INTO aws_target_group
          (target_group_name, target_type, protocol, port, vpc, health_check_path)
      VALUES
          ('${serviceTargetGroupName}', 'ip', 'HTTP', ${hostPort}, 'default', '/health');
      INSERT INTO aws_load_balancer
          (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
      VALUES
          ('${serviceLoadBalancerName}', 'internet-facing', 'default', 'application', 'ipv4');
      INSERT INTO aws_load_balancer_security_groups
          (aws_load_balancer_id, aws_security_group_id)
      VALUES
          ((SELECT id FROM aws_load_balancer WHERE load_balancer_name = '${serviceLoadBalancerName}' LIMIT 1),
            (SELECT id FROM aws_security_group WHERE group_name = 'default' LIMIT 1));
      INSERT INTO aws_listener
          (aws_load_balancer_id, port, protocol, action_type, target_group_id)
      VALUES 
          ((SELECT id FROM aws_load_balancer WHERE load_balancer_name = '${serviceLoadBalancerName}' LIMIT 1), 
            ${hostPort}, 'HTTP', 'forward', (SELECT id FROM aws_target_group WHERE target_group_name = '${serviceTargetGroupName}' LIMIT 1));
    COMMIT;
  `));

  it('applies aws_service dependencies', apply);

  // Service spinning up a task definition with container using a docker image
  describe('Docker image', () => {
    // Container definition
    it('adds container dependencies', query(`
      INSERT INTO log_group (log_group_name)
      VALUES ('${logGroupName}');
    `));

    it('applies adds container dependencies', apply);

    // Task definition
    it('adds a new task definition', query(`
      INSERT INTO aws_task_definition ("family", task_role_arn, execution_role_arn, cpu_memory)
      VALUES ('${tdFamily}', '${taskExecRole}', '${taskExecRole}', '${tdCpuMem}');
    `));

    it('check aws_task_definition insertion', query(`
      SELECT *
      FROM aws_task_definition
      WHERE family = '${tdFamily}' AND status IS NULL;
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('adds a new container definition', query(`
      BEGIN;
        INSERT INTO aws_container_definition ("name", image, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id, log_group_id)
        VALUES('${containerName}', '${image}', ${containerEssential}, ${containerMemoryReservation}, ${hostPort}, ${containerPort}, '${protocol}', '{ "test": 2}', (select id from aws_task_definition where family = '${tdFamily}' and status is null limit 1), (select id from log_group where log_group_name = '${logGroupName} limit 1'));
        INSERT INTO aws_container_definition ("name", image, tag, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id, log_group_id)
        VALUES('${containerNameTag}', '${image}', '${imageTag}', false, ${containerMemoryReservation}, ${hostPort + 1}, ${containerPort + 1}, '${protocol}', '{ "test": 2}', (select id from aws_task_definition where family = '${tdFamily}' and status is null limit 1), (select id from log_group where log_group_name = '${logGroupName} limit 1'));
        INSERT INTO aws_container_definition ("name", image, digest, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id, log_group_id)
        VALUES('${containerNameDigest}', '${image}', '${imageDigest}', false, ${containerMemoryReservation}, ${hostPort + 2}, ${containerPort + 2}, '${protocol}', '{ "test": 2}', (select id from aws_task_definition where family = '${tdFamily}' and status is null limit 1), (select id from log_group where log_group_name = '${logGroupName} limit 1'));
      COMMIT;
    `));

    it('check container definition insertion', query(`
      SELECT *
      FROM aws_container_definition
      WHERE name = '${containerName}' AND image = '${image}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('check container definition insertion', query(`
      SELECT *
      FROM aws_container_definition
      WHERE name = '${containerNameTag}' AND image = '${image}' AND tag = '${imageTag}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('check container definition insertion', query(`
      SELECT *
      FROM aws_container_definition
      WHERE name = '${containerNameDigest}' AND image = '${image}' AND digest = '${imageDigest}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('applies adds a new task definition with container definition', apply);

    // Service
    it('adds a new aws_service', query(`
      BEGIN;
        INSERT INTO aws_service ("name", desired_count, subnets, assign_public_ip, cluster_id, task_definition_id, target_group_id)
        VALUES ('${serviceName}', ${serviceDesiredCount}, (select array(select subnet_id from aws_subnet inner join aws_vpc on aws_vpc.id = aws_subnet.vpc_id where is_default = true limit 3)), 'ENABLED', (select id from aws_cluster where cluster_name = '${clusterName}'), (select id from aws_task_definition where family = '${tdFamily}' order by revision desc limit 1), (select id from aws_target_group where target_group_name = '${serviceTargetGroupName}' limit 1));

        INSERT INTO aws_service_security_groups (aws_service_id, aws_security_group_id)
        VALUES ((select id from aws_service where name = '${serviceName}' limit 1), (select id from aws_security_group where group_name = 'default' limit 1));
      COMMIT;
    `));

    it('check aws_service insertion', query(`
      SELECT *
      FROM aws_service
      WHERE name = '${serviceName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('check aws_service_security_groups insertion', query(`
      SELECT *
      FROM aws_service_security_groups
      INNER JOIN aws_service ON aws_service.id = aws_service_security_groups.aws_service_id
      WHERE aws_service.name = '${serviceName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('tries to update a task definition', query(`
      WITH td AS (
        SELECT revision
        FROM aws_task_definition
        WHERE family = '${tdFamily}' AND status = '${tdActive}'
        ORDER BY family, revision DESC
        LIMIT 1
      )
      UPDATE aws_task_definition SET revision = 55 WHERE family = '${tdFamily}' AND revision IN (SELECT revision FROM td);
    `));
    
    it('applies tries to update a task definition field', apply);
    
    it('check aws_task_definition update', query(`
      SELECT *
      FROM aws_task_definition
      WHERE family = '${tdFamily}' AND status = '${tdActive}';
    `, (res: any[]) => expect(res.length).toBe(2)));

    
    it('tries to update a aws_service (update)', query(`
      UPDATE aws_service SET desired_count = ${serviceDesiredCount + 1} WHERE name = '${serviceName}';
    `));

    it('applies tries to update a aws_service (update)', apply);

    it('tries to update a aws_service (restore)', query(`
      UPDATE aws_service SET status = 'fake' WHERE name = '${serviceName}';
    `));

    it('applies tries to update a aws_service (restore)', apply);

    it('tries to update a aws_service (replace)', query(`
      UPDATE aws_service SET name = '${newServiceName}' WHERE name = '${serviceName}';
    `));

    it('applies tries to update a aws_service (replace)', apply);

    it('deletes aws_service', query(`
      BEGIN;
        delete from aws_service_security_groups
        using aws_service
        where name = '${newServiceName}';

        delete from aws_service
        where name = '${newServiceName}';
      COMMIT;
    `));

    it('applies deletes aws_service', apply);

    it('deletes container definitons', query(`
      begin;
        delete from aws_container_definition
        using aws_task_definition
        where aws_container_definition.task_definition_id = aws_task_definition.id and aws_task_definition.family = '${tdFamily}';

        delete from aws_task_definition
        where family = '${tdFamily}';

        delete from log_group
        where log_group_name = '${logGroupName}';
      commit;
    `));

    it('applies deletes tasks and container definitions', apply);
  });

  // Service spinning up a task definition with container using a private ecr
  describe('Private ECR', () => {
    // ECR
    it('adds a new ECR', query(`
      INSERT INTO aws_repository
          (repository_name)
      VALUES
          ('${repositoryName}');
    `));

    it('check aws_repository insertion', query(`
      SELECT *
      FROM aws_repository
      WHERE repository_name = '${repositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    // Task definition
    it('adds a new task definition', query(`
      INSERT INTO aws_task_definition ("family", task_role_arn, execution_role_arn, cpu_memory)
      VALUES ('${tdRepositoryFamily}', '${taskExecRole}', '${taskExecRole}', '${tdCpuMem}');
    `));

    it('check aws_task_definition insertion', query(`
      SELECT *
      FROM aws_task_definition
      WHERE family = '${tdRepositoryFamily}' AND status IS NULL;
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('adds a new container definition', query(`
      BEGIN;
        INSERT INTO aws_container_definition ("name", repository_id, tag, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id)
        VALUES('${containerNameRepository}', (select id from aws_repository where repository_name = '${repositoryName}' limit 1), '${imageTag}', ${containerEssential}, ${containerMemoryReservation}, ${hostPort}, ${containerPort}, '${protocol}', '{ "test": 2}', (select id from aws_task_definition where family = '${tdRepositoryFamily}' and status is null limit 1));
        INSERT INTO aws_container_definition ("name", repository_id, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id)
        VALUES('${containerNameRepository}dgst', (select id from aws_repository where repository_name = '${repositoryName}' limit 1), false, ${containerMemoryReservation}, ${hostPort + 2}, ${containerPort + 2}, '${protocol}', '{ "test": 2}', (select id from aws_task_definition where family = '${tdRepositoryFamily}' and status is null limit 1));  
      COMMIT;  
    `));

    it('check container definition insertion', query(`
      SELECT *
      FROM aws_container_definition
      WHERE name = '${containerNameRepository}' AND repository_id = (select id from aws_repository where repository_name = '${repositoryName}' limit 1) AND tag = '${imageTag}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('applies adds a new task definition with container definition', apply);

    // Service
    it('adds a new aws_service', query(`
      BEGIN;
        INSERT INTO aws_service ("name", desired_count, subnets, assign_public_ip, cluster_id, task_definition_id, target_group_id)
        VALUES ('${serviceRepositoryName}', ${serviceDesiredCount}, (select array(select subnet_id from aws_subnet inner join aws_vpc on aws_vpc.id = aws_subnet.vpc_id where is_default = true limit 3)), 'ENABLED', (select id from aws_cluster where cluster_name = '${clusterName}'), (select id from aws_task_definition where family = '${tdRepositoryFamily}' order by revision desc limit 1), (select id from aws_target_group where target_group_name = '${serviceTargetGroupName}' limit 1));

        INSERT INTO aws_service_security_groups (aws_service_id, aws_security_group_id)
        VALUES ((select id from aws_service where name = '${serviceRepositoryName}' limit 1), (select id from aws_security_group where group_name = 'default' limit 1));
      COMMIT;
    `));

    it('check aws_service insertion', query(`
      SELECT *
      FROM aws_service
      WHERE name = '${serviceRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('check aws_service_security_groups insertion', query(`
      SELECT *
      FROM aws_service_security_groups
      INNER JOIN aws_service ON aws_service.id = aws_service_security_groups.aws_service_id
      WHERE aws_service.name = '${serviceRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('deletes aws_service', query(`
      BEGIN;
        delete from aws_service_security_groups
        using aws_service
        where name = '${serviceRepositoryName}';

        delete from aws_service
        where name = '${serviceRepositoryName}';
      COMMIT;
    `));

    it('applies deletes aws_service', apply);

    it('deletes container definitons', query(`
      begin;
        delete from aws_container_definition
        using aws_task_definition
        where aws_container_definition.task_definition_id = aws_task_definition.id and aws_task_definition.family = '${tdRepositoryFamily}';

        delete from aws_task_definition
        where family = '${tdRepositoryFamily}';

        delete from aws_repository
        where repository_name = '${repositoryName}';
      commit;
    `));

    it('applies deletes tasks and container definitions', apply);
  });

  // Service spinning up a task definition with container using a public ecr
  describe('Public ECR', () => {
    // ECR
    it('adds a new public ECR', query(`
      INSERT INTO aws_public_repository
          (repository_name)
      VALUES
          ('${publicRepositoryName}');
    `));

    it('check aws_public_repository insertion', query(`
      SELECT *
      FROM aws_public_repository
      WHERE repository_name = '${publicRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    // Task definition
    it('adds a new task definition', query(`
      INSERT INTO aws_task_definition ("family", task_role_arn, execution_role_arn, cpu_memory)
      VALUES ('${tdPublicRepositoryFamily}', '${taskExecRole}', '${taskExecRole}', '${tdCpuMem}');
    `));

    it('check aws_task_definition insertion', query(`
      SELECT *
      FROM aws_task_definition
      WHERE family = '${tdPublicRepositoryFamily}' AND status IS NULL;
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('adds a new container definition', query(`
      INSERT INTO aws_container_definition ("name", public_repository_id, tag, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id)
	    VALUES('${containerNamePublicRepository}', (select id from aws_public_repository where repository_name = '${publicRepositoryName}' limit 1), '${imageTag}', ${containerEssential}, ${containerMemoryReservation}, ${hostPort}, ${containerPort}, '${protocol}', '{ "test": 2}', (select id from aws_task_definition where family = '${tdPublicRepositoryFamily}' and status is null limit 1));
    `));

    it('check container definition insertion', query(`
      SELECT *
      FROM aws_container_definition
      WHERE name = '${containerNamePublicRepository}' AND public_repository_id = (select id from aws_public_repository where repository_name = '${publicRepositoryName}' limit 1) AND tag = '${imageTag}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('applies adds a new task definition with container definition', apply);

    // Service
    it('adds a new aws_service', query(`
      BEGIN;
        INSERT INTO aws_service ("name", desired_count, subnets, assign_public_ip, cluster_id, task_definition_id, target_group_id)
        VALUES ('${servicePublicRepositoryName}', ${serviceDesiredCount}, (select array(select subnet_id from aws_subnet inner join aws_vpc on aws_vpc.id = aws_subnet.vpc_id where is_default = true limit 3)), 'ENABLED', (select id from aws_cluster where cluster_name = '${clusterName}'), (select id from aws_task_definition where family = '${tdPublicRepositoryFamily}' order by revision desc limit 1), (select id from aws_target_group where target_group_name = '${serviceTargetGroupName}' limit 1));

        INSERT INTO aws_service_security_groups (aws_service_id, aws_security_group_id)
        VALUES ((select id from aws_service where name = '${servicePublicRepositoryName}' limit 1), (select id from aws_security_group where group_name = 'default' limit 1));
      COMMIT;
    `));

    it('check aws_service insertion', query(`
      SELECT *
      FROM aws_service
      WHERE name = '${servicePublicRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('check aws_service_security_groups insertion', query(`
      SELECT *
      FROM aws_service_security_groups
      INNER JOIN aws_service ON aws_service.id = aws_service_security_groups.aws_service_id
      WHERE aws_service.name = '${servicePublicRepositoryName}';
    `, (res: any[]) => expect(res.length).toBe(1)));

    it('deletes aws_service', query(`
      BEGIN;
        delete from aws_service_security_groups
        using aws_service
        where name = '${servicePublicRepositoryName}';

        delete from aws_service
        where name = '${servicePublicRepositoryName}';
      COMMIT;
    `));

    it('applies deletes aws_service', apply);

    it('deletes container definitons', query(`
      begin;
        delete from aws_container_definition
        using aws_task_definition
        where aws_container_definition.task_definition_id = aws_task_definition.id and aws_task_definition.family = '${tdPublicRepositoryFamily}';

        delete from aws_task_definition
        where family = '${tdPublicRepositoryFamily}';

        delete from aws_public_repository
        where repository_name = '${publicRepositoryName}';
      commit;
    `));

    it('applies deletes tasks and container definitions', apply);
  });

  // deletes aws_service dependencies
  it('deletes aws_service dependencies', query(`
    BEGIN;
      DELETE FROM aws_listener
      WHERE aws_load_balancer_id = (SELECT id FROM aws_load_balancer WHERE load_balancer_name = '${serviceLoadBalancerName}' LIMIT 1)
        and port = ${hostPort} and protocol = 'HTTP' and action_type = 'forward' 
        and target_group_id = (SELECT id FROM aws_target_group WHERE target_group_name = '${serviceTargetGroupName}' LIMIT 1);

      DELETE FROM aws_load_balancer_security_groups
      WHERE aws_load_balancer_id = (SELECT id FROM aws_load_balancer WHERE load_balancer_name = '${serviceLoadBalancerName}' LIMIT 1);
    
      DELETE FROM aws_load_balancer
      WHERE load_balancer_name = '${serviceLoadBalancerName}';

      DELETE FROM aws_target_group
      WHERE target_group_name = '${serviceTargetGroupName}'; 
    COMMIT;
  `));

  it('applies deletes aws_service dependencies', apply);

  it('tries to update a aws_cluster field (restore)', query(`
    UPDATE aws_cluster SET cluster_status = 'fake' WHERE cluster_name = '${clusterName}';
  `));

  it('applies tries to update a aws_cluster field (restore)', apply);

  it('tries to update cluster (replace)', query(`
    UPDATE aws_cluster SET cluster_name = '${newClusterName}' WHERE cluster_name = '${clusterName}';
  `));

  it('applies tries to update cluster (replace)', apply);

  it('deletes the aws_cluster', query(`
    delete from aws_cluster
    where cluster_name = '${newClusterName}';
  `));

  it('applies deletes the aws_cluster', apply);

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('ECS install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    'us-east-1', // Share region with common tests
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the ECS module', (done) => void iasql.install(
    ['aws_ecr@0.0.1', 'aws_elb@0.0.1', 'aws_security_group@0.0.1', 'aws_cloudwatch@0.0.1', 'aws_ecs_fargate@0.0.1', 'aws_vpc@0.0.1',],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('uninstalls the ECS module', (done) => void iasql.uninstall(
    ['aws_ecr@0.0.1', 'aws_elb@0.0.1', 'aws_security_group@0.0.1', 'aws_cloudwatch@0.0.1', 'aws_ecs_fargate@0.0.1', 'aws_vpc@0.0.1',],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    'not-needed',
    true).then(...finish(done)));

  it('uninstalls the ECS module', (done) => void iasql.uninstall(
    ['aws_ecs_fargate@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('installs the ECS module', (done) => void iasql.install(
    ['aws_ecs_fargate@0.0.1'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
