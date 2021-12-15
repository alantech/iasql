do $$
<<quickstart>>
  declare
    default_vpc text;
    default_vpc_id integer;
    sn record;
    default_subnets text[];
    port integer := 8088;
    target_group text := 'quickstart-target-group';
    target_group_health_path text := '/';
    load_balancer text := 'quickstart-load-balancer';
    repository text := 'quickstart-repository';
    repository_policy text := '{ "Version" : "2012-10-17", "Statement" : [ { "Sid" : "new statement", "Effect" : "Allow", "Principal" : { "AWS" : [ "arn:aws:iam::547931376551:role/AWSECSTaskExecution", "arn:aws:iam::547931376551:user/dfellis", "arn:aws:iam::547931376551:user/aguillenv", "arn:aws:iam::547931376551:user/depombo" ] }, "Action" : [ "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:CreateRepository", "ecr:DeleteRepositoryPolicy", "ecr:DescribeImageScanFindings", "ecr:DescribeImages", "ecr:DescribeRepositories", "ecr:GetAuthorizationToken", "ecr:GetDownloadUrlForLayer", "ecr:GetLifecyclePolicy", "ecr:GetLifecyclePolicyPreview", "ecr:GetRepositoryPolicy", "ecr:ListImages", "ecr:ListTagsForResource", "ecr:SetRepositoryPolicy" ] } ]}';
    quickstart_cluster text := 'quickstart-cluster';
    container text := 'quickstart-container';
    container_memory_reservation integer := 8192;
    image_tag text := 'latest';
    task_definition text := 'quickstart-task-definition';
    task_definition_resources text := '2vCPU-8GB';
    ecs_task_execution_role text := '<AWS_ECS_EXEC_ROLE>';
    security_group text := 'quickstart-security-group';
    service text := 'quickstart-service';
    service_desired_count integer := 1;
    cloud_watch_log_group text := 'quickstart-log-group';
    quickstart_rds text := 'quickstart-rds';
    quickstart_rds_port integer := 5432;
    quickstart_rds_security_group text := 'quickstart-rds';
    quickstart_rds_allocated_storage integer := 1024; -- 1TiB in MiB
    quickstart_rds_db_instance_class text := 'db.m5.large';
    quickstart_rds_db_engine text := 'postgres';
    quickstart_rds_db_engine_version text := '13.4';
    quickstart_rds_db_username text := 'iasql';
    quickstart_rds_db_password text := '<DB_PASSWORD>';  -- Do not commit db password value
    quickstart_rds_db_az text := 'us-east-2a';
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

    call create_aws_target_group(
      target_group, 'ip', port, default_vpc, 'HTTP', target_group_health_path
    );

    call create_aws_load_balancer(
      load_balancer, 'internet-facing', default_vpc, 'application', default_subnets, 'ipv4'
    );

    call create_aws_listener(load_balancer, port, 'HTTP', 'forward', target_group);

    call create_ecr_repository(repository);

    call create_ecr_repository_policy(repository, repository_policy);

    call create_ecs_cluster(quickstart_cluster);

    call create_cloudwatch_log_group(cloud_watch_log_group);

    call create_task_definition(
      task_definition, ecs_task_execution_role, ecs_task_execution_role,
      'awsvpc', array['FARGATE']::compatibility_name_enum[], task_definition_resources
    );

    call create_container_definition(
      task_definition, container, true, container_memory_reservation, port, port, 'tcp',
      ('{"PORT": ' || port || '}')::json, image_tag,
      _ecr_repository_name := repository, _cloud_watch_log_group := cloud_watch_log_group
    );

    call create_aws_security_group(
      security_group, security_group,
      ('[{"isEgress": false, "ipProtocol": "tcp", "fromPort": ' || port || ', "toPort": ' || port || ', "cidrIpv4": "0.0.0.0/0"}, {"isEgress": true, "ipProtocol": -1, "fromPort": -1, "toPort": -1, "cidrIpv4": "0.0.0.0/0"}]')::jsonb
    );

    call create_ecs_service(
      service, quickstart_cluster, task_definition, service_desired_count, 'FARGATE',
      'REPLICA', default_subnets, array[security_group], 'ENABLED', target_group
    );

    call create_aws_security_group(
      quickstart_rds_security_group, quickstart_rds_security_group,
      ('[{"isEgress": false, "ipProtocol": "tcp", "fromPort": ' || quickstart_rds_port || ', "toPort": ' || quickstart_rds_port || ', "cidrIpv4": "0.0.0.0/0"}, {"isEgress": true, "ipProtocol": -1, "fromPort": -1, "toPort": -1, "cidrIpv4": "0.0.0.0/0"}]')::jsonb
    );

    call create_rds(
      quickstart_rds, quickstart_rds_allocated_storage, quickstart_rds_db_instance_class,
      quickstart_rds_db_engine, quickstart_rds_db_engine_version, quickstart_rds_db_username,
      quickstart_rds_db_password, quickstart_rds_db_az, array[iasql_postgres_security_group]
    );

  end quickstart
$$;
