do $$
<<iasql>>
  declare
    default_vpc text;
    default_vpc_id integer;
    sn record;
    default_subnets text[];
    iasql_engine_port integer := 8088;
    iasql_postgres_port integer := 5432;
    iasql_engine_target_group text := 'iasql-engine-target-group';
    iasql_postgres_target_group text := 'iasql-postgres-target-group';
    iasql_engine_load_balancer text := 'iasql-engine-load-balancer';
    iasql_postgres_load_balancer text := 'iasql-postgres-load-balancer';
    iasql_engine_repository text := 'iasql-engine-repository';
    iasql_postgres_docker_image text := 'postgres';
    iasql_cluster text := 'iasql-cluster';
    iasql_engine_container text := 'iasql-engine-container';
    iasql_engine_container_memory_reservation integer := 8192;
    iasql_engine_image_tag text := 'latest';
    iasql_postgres_container text := 'iasql-postgres-container';
    iasql_postgres_image_tag text := '13.4';
    iasql_engine_task_definition text := 'iasql-engine-task-definition';
    iasql_postgres_task_definition text := 'iasql-postgres-task-definition';
    iasql_ecs_task_execution_role text := 'arn:aws:iam::547931376551:role/AWSECSTaskExecution';
    iasql_engine_security_group text := 'iasql-engine-security-group';
    iasql_postgres_security_group text := 'iasql-postgres-security-group';
    iasql_engine_service text := 'iasql-engine-service';
    iasql_engine_service_desired_count integer := 1;
    iasql_postgres_service text := 'iasql-postgres-service';
    iasql_postgres_rds text := 'iasql-postgres-rds';
    iasql_postgres_rds_allocated_storage integer := 1024; -- 1TiB in MiB
    iasql_postgres_rds_db_instance_class text := 'db.m5.large';
    iasql_postgres_rds_db_engine text := 'postgres';
    iasql_postgres_rds_db_engine_version text := '13.4';
    iasql_postgres_rds_db_username text := 'iasql';
    iasql_postgres_rds_db_password text := '<DB_PASSWORD>';  -- Do not commit db password value
    iasql_postgres_rds_db_az text := 'us-east-2a';
    iasql_db_host text := 'db.iasql.com';
    iasql_db_user text := 'iasql';
    iasql_db_password text := '<DB_PASSWORD>';  -- Do not commit db password value
    iasql_ip_secret text := '<IRONPLANS_TOKEN>'; -- Do not commit ip secret value
    iasql_a0_enabled text := 'true';
    iasql_a0_domain text := 'https://auth.iasql.com/';
    iasql_a0_audience text := 'https://api.iasql.com';
    iasql_engine_cloud_watch_log_group text := 'iasql-engine-log-group';
    iasql_sentry_enabled text := 'true';
    iasql_sentry_dsn text := 'https://e257e8d6646e4657b4f556efc1de31e8@o1090662.ingest.sentry.io/6106929';
  begin
    select vpc_id, id into default_vpc, default_vpc_id
    from aws_vpc
    where is_default = true
    limit 1;

    for sn in
      select *
      from aws_subnet
      where vpc_id = default_vpc_id
    loop
      default_subnets := array_append(default_subnets, sn.subnet_id::text);
    end loop;

    call create_aws_security_group(
      iasql_engine_security_group, iasql_engine_security_group,
      ('[{"isEgress": false, "ipProtocol": "tcp", "fromPort": ' || iasql_engine_port || ', "toPort": ' || iasql_engine_port || ', "cidrIpv4": "0.0.0.0/0"}, {"isEgress": false, "ipProtocol": "tcp", "fromPort": "443", "toPort": "443", "cidrIpv4": "0.0.0.0/0"}, {"isEgress": true, "ipProtocol": -1, "fromPort": -1, "toPort": -1, "cidrIpv4": "0.0.0.0/0"}]')::jsonb
    );

    call create_aws_target_group(
      iasql_engine_target_group, 'ip', iasql_engine_port, default_vpc, 'HTTP', '/health'
    );

    call create_aws_load_balancer(
      iasql_engine_load_balancer, 'internet-facing', default_vpc, 'application', default_subnets, 'ipv4', array[iasql_engine_security_group]
    );

    -- TODO: update this listener once HTTPS can be configure via IaSQL
    call create_aws_listener(iasql_engine_load_balancer, iasql_engine_port, 'HTTP', 'forward', iasql_engine_target_group);

    call create_or_update_ecr_repository(iasql_engine_repository);

    -- TODO: how to handle better this hard coded policy?
    call create_or_update_ecr_repository_policy(
      iasql_engine_repository, '{ "Version" : "2012-10-17", "Statement" : [ { "Sid" : "new statement", "Effect" : "Allow", "Principal" : { "AWS" : [ "arn:aws:iam::547931376551:role/AWSECSTaskExecution", "arn:aws:iam::547931376551:user/dfellis", "arn:aws:iam::547931376551:user/aguillenv", "arn:aws:iam::547931376551:user/depombo" ] }, "Action" : [ "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CreateRepository", "ecr:DeleteRepositoryPolicy", "ecr:DescribeImageScanFindings", "ecr:DescribeImages", "ecr:DescribeRepositories", "ecr:GetAuthorizationToken", "ecr:GetDownloadUrlForLayer", "ecr:GetLifecyclePolicy", "ecr:GetLifecyclePolicyPreview", "ecr:GetRepositoryPolicy", "ecr:ListImages", "ecr:ListTagsForResource", "ecr:SetRepositoryPolicy" ] } ]}'
    );

    call create_or_update_ecs_cluster(iasql_cluster);

    call create_or_update_cloudwatch_log_group(iasql_engine_cloud_watch_log_group);

    call create_task_definition(
      iasql_engine_task_definition, iasql_ecs_task_execution_role, iasql_ecs_task_execution_role,
      'awsvpc', array['FARGATE']::compatibility_name_enum[], '2vCPU-8GB'
    );

    call create_container_definition(
      iasql_engine_task_definition, iasql_engine_container, true, iasql_engine_container_memory_reservation, iasql_engine_port, iasql_engine_port, 'tcp',
      ('{"PORT": ' || iasql_engine_port || ', "SENTRY_ENABLED": "' || iasql_sentry_enabled || '", "SENTRY_DSN": "' || iasql_sentry_dsn || '", "DB_HOST": "' || iasql_db_host || '", "DB_USER": "' || iasql_db_user || '", "A0_ENABLED": "' || iasql_a0_enabled || '", "A0_DOMAIN": "' || iasql_a0_domain || '", "A0_AUDIENCE": "' || iasql_a0_audience || '", "DB_PASSWORD": "' || iasql_db_password || '", "IRONPLANS_TOKEN": "' || iasql_ip_secret || '"}')::json, iasql_engine_image_tag,
      _ecr_repository_name := iasql_engine_repository, _cloud_watch_log_group := iasql_engine_cloud_watch_log_group
    );

    call create_or_update_ecs_service(
      iasql_engine_service, iasql_cluster, iasql_engine_task_definition, iasql_engine_service_desired_count, 'FARGATE',
      'REPLICA', default_subnets, array[iasql_engine_security_group], 'ENABLED', iasql_engine_target_group
    );

    call create_aws_security_group(
      iasql_postgres_security_group, iasql_postgres_security_group,
      ('[{"isEgress": false, "ipProtocol": "tcp", "fromPort": ' || iasql_postgres_port || ', "toPort": ' || iasql_postgres_port || ', "cidrIpv4": "0.0.0.0/0"}, {"isEgress": true, "ipProtocol": -1, "fromPort": -1, "toPort": -1, "cidrIpv4": "0.0.0.0/0"}]')::jsonb
    );

    call create_rds(
      iasql_postgres_rds, iasql_postgres_rds_allocated_storage, iasql_postgres_rds_db_instance_class,
      iasql_postgres_rds_db_engine, iasql_postgres_rds_db_engine_version, iasql_postgres_rds_db_username,
      iasql_postgres_rds_db_password, iasql_postgres_rds_db_az, array[iasql_postgres_security_group]
    );


    -- TODO: Restore once we manage our own iasql instance
    
    
    -- call create_aws_target_group(
    --   iasql_postgres_target_group, 'ip', iasql_postgres_port, default_vpc, 'TCP'
    -- );

    -- call create_aws_listener(iasql_postgres_load_balancer, iasql_postgres_port, 'TCP', 'forward', iasql_postgres_target_group);

    -- call create_aws_load_balancer(
    --   iasql_postgres_load_balancer, 'internet-facing', default_vpc, 'network', default_subnets, 'ipv4'
    -- );

    -- call create_container_definition(
    --   iasql_postgres_container, true, 8192, iasql_postgres_port, iasql_postgres_port, 'tcp',
    --   ('{"PORT": ' || iasql_postgres_port || ',"POSTGRES_PASSWORD": "test"}')::json, iasql_postgres_image_tag,
    --   _docker_image := iasql_postgres_docker_image
    -- );

    -- call create_task_definition(
    --   iasql_postgres_task_definition, iasql_ecs_task_execution_role, iasql_ecs_task_execution_role,
    --   'awsvpc', array['FARGATE']::compatibility_name_enum[], '2vCPU-8GB', array[iasql_postgres_container]
    -- );

    -- call create_or_update_ecs_service(
    --   iasql_postgres_service, iasql_cluster, iasql_postgres_task_definition, 1, 'FARGATE',
    --   'REPLICA', default_subnets, array[iasql_postgres_security_group], 'ENABLED', iasql_postgres_target_group
    -- );

  end iasql
$$;
