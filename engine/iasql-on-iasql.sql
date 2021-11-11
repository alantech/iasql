BEGIN;
  declare 
    default_vpc text;
    -- TODO: default_subnets text[]; -- array['subnet-72521928','subnet-a58a84c3','subnet-68312820']
    default_subnets := array['subnet-72521928','subnet-a58a84c3','subnet-68312820'];
    iasql_engine_port := 8088;
    iasql_postgres_port := 5432;
    iasql_engine_target_group := 'iasql-engine-target-group';
    iasql_postgres_target_group := 'iasql-postgres-target-group';
    iasql_engine_load_balancer := 'iasql-engine-load-balancer';
    iasql_postgres_load_balancer := 'iasql-postgres-load-balancer';
    iasql_engine_repository := 'iasql-engine-repository';
    iasql_postgres_docker_image := 'postgres';
    iasql_cluster := 'iasql-cluster';
    iasql_engine_container := 'iasql-engine-container';
    iasql_engine_image_tag := 'latest';
    iasql_postgres_container := 'iasql-postgres-container';
    iasql_postgres_image_tag := '13.4';
    iasql_engine_task_definition := 'iasql-engine-task-definition';
    iasql_postgres_task_definition := 'iasql-postgres-task-definition';
    iasql_ecs_task_execution_role := 'arn:aws:iam::257682470237:role/ecsTaskExecutionRole';
    iasql_engine_security_group := 'iasql-engine-security-group';
    iasql_postgres_security_group := 'iasql-postgres-security-group';
    iasql_engine_service := 'iasql-engine-service';
    iasql_postgres_service := 'iasql-postgres-service';

  select vpc_id into default_vpc
  from vpc
  where is_default = true
  limit 1;

  -- TODO: Create a list of strings of default subnet names

  select * from create_target_group(
    iasql_engine_target_group, 'ip', iasql_engine_port, default_vpc, 'TCP'
  );

  select * from create_target_group(
    iasql_postgres_target_group, 'ip', iasql_postgres_port, default_vpc, 'TCP'
  );

  select * from create_load_balancer(
    iasql_engine_load_balancer, 'internet-facing', default_vpc, 'network', default_subnets, 'ipv4'
  );

  select create_listener(iasql_engine_load_balancer, iasql_engine_port, 'TCP', 'forward', iasql_engine_target_group);

  select * from create_load_balancer(
    iasql_postgres_load_balancer, 'internet-facing', default_vpc, 'network', default_subnets, 'ipv4'
  );

  select create_listener(iasql_postgres_load_balancer, iasql_postgres_port, 'TCP', 'forward', iasql_postgres_target_group);

  select * from create_ecr_repository(iasql_engine_repository);

  select * from create_ecr_repository_policy(
    iasql_engine_repository, '{ "Version" : "2012-10-17", "Statement" : [ { "Sid" : "new statement", "Effect" : "Allow", "Principal" : { "AWS" : "arn:aws:iam::257682470237:user/automate" }, "Action" : [ "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CreateRepository", "ecr:DeleteRepositoryPolicy", "ecr:DescribeImageScanFindings", "ecr:DescribeImages", "ecr:DescribeRepositories", "ecr:GetAuthorizationToken", "ecr:GetDownloadUrlForLayer", "ecr:GetLifecyclePolicy", "ecr:GetLifecyclePolicyPreview", "ecr:GetRepositoryPolicy", "ecr:ListImages", "ecr:ListTagsForResource", "ecr:SetRepositoryPolicy" ] } ]}	'
  );

  select * from create_ecs_cluster(iasql_cluster);

  -- TODO: is it possible to interpolate in the json??
  select * from create_container_definition(
    iasql_engine_container, true, 8192, iasql_engine_port, iasql_engine_port, 'tcp',
    '{"PORT": 8088}', iasql_engine_image_tag,
    _ecr_repository_name := iasql_engine_repository
  );

  -- TODO: remove revision from task procedure and let the store procedure insert it
  select *
  from create_task_definition(
    iasql_engine_task_definition, 1, iasql_ecs_task_execution_role, iasql_ecs_task_execution_role,
    'awsvpc', array['FARGATE']::compatibility_name_enum[], '2vCPU-8GB', array[iasql_engine_container]
  );

  -- TODO: check if json could be interpolated
  select *
  from create_security_group(
    iasql_engine_security_group, iasql_engine_security_group,
    '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": 8088, "toPort": 8088, "cidrIpv4": "0.0.0.0/0"}]'
  );

  -- TODO: remove revision from task procedure and let the store procedure insert it
  select *
  from create_ecs_service(
    iasql_engine_service, iasql_cluster, iasql_engine_task_definition, '1', 1, 'FARGATE',
    'REPLICA', default_subnets, array[iasql_engine_security_group], 'ENABLED', iasql_engine_target_group
  );

  select * from create_container_definition(
    iasql_postgres_container, true, 8192, iasql_postgres_port, iasql_postgres_port, 'tcp',
    '{"PORT":5432,"POSTGRES_PASSWORD":"test"}', iasql_postgres_image_tag,
    _docker_image := iasql_postgres_docker_image
  );

  -- TODO: remove revision from task procedure and let the store procedure insert it
  select *
  from create_task_definition(
    iasql_postgres_task_definition, 1, iasql_ecs_task_execution_role, iasql_ecs_task_execution_role,
    'awsvpc', array['FARGATE']::compatibility_name_enum[], '2vCPU-8GB', array[iasql_postgres_container]
  );

  -- TODO: check if json could be interpolated
  select *
  from create_security_group(
    iasql_postgres_security_group, iasql_postgres_security_group,
    '[{"isEgress": false, "ipProtocol": "tcp", "fromPort": 5432, "toPort": 5432, "cidrIpv4": "0.0.0.0/0"}]'
  );

  -- TODO: remove revision from task procedure and let the store procedure insert it
  select *
  from create_ecs_service(
    iasql_postgres_service, iasql_cluster, iasql_postgres_task_definition, '1', 1, 'FARGATE',
    'REPLICA', default_subnets, array[iasql_postgres_security_group], 'ENABLED', iasql_postgres_target_group
  );

COMMIT;
