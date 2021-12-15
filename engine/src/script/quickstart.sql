do $$
<<quickstart>>
  declare
    project_name text := 'quickstart';
    default_vpc text;
    default_vpc_id integer;
    sn record;
    default_subnets text[];
    port integer := 8088;
    target_group text := project_name || '-target-group';
    target_group_health_path text := '/';
    load_balancer text := project_name || '-load-balancer';
    repository text := project_name || '-repository';
    repository_policy text := '{ "Version" : "2012-10-17", "Statement" : []}';
    quickstart_cluster text := project_name || '-cluster';
    container text := project_name || '-container';
    container_memory_reservation integer := 8192; -- in MiB
    image_tag text := 'latest';
    task_definition text := project_name || '-task-definition';
    task_definition_resources text := '2vCPU-8GB';
    ecs_task_execution_role text := '<AWS_ECS_EXEC_ROLE>';  -- Need to be filled
    security_group text := project_name || '-security-group';
    service text := project_name || '-service';
    service_desired_count integer := 1;
    cloud_watch_log_group text := project_name || '-log-group';
    rds text := project_name || '-rds';
    rds_port integer := 5432;
    rds_security_group text := project_name || '-rds';
    rds_allocated_storage integer := 1024; -- 1TiB in MiB
    rds_db_instance_class text := 'db.m5.large';
    rds_db_engine text := 'postgres';
    rds_db_engine_version text := '13.4';
    rds_db_username text := 'iasql';
    rds_db_password text := '<DB_PASSWORD>';  -- Do not commit db password value
    rds_db_az text := 'us-east-2a';
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
      rds_security_group, rds_security_group,
      ('[{"isEgress": false, "ipProtocol": "tcp", "fromPort": ' || rds_port || ', "toPort": ' || rds_port || ', "cidrIpv4": "0.0.0.0/0"}, {"isEgress": true, "ipProtocol": -1, "fromPort": -1, "toPort": -1, "cidrIpv4": "0.0.0.0/0"}]')::jsonb
    );

    call create_rds(
      rds, rds_allocated_storage, rds_db_instance_class,
      rds_db_engine, rds_db_engine_version, rds_db_username,
      rds_db_password, rds_db_az, array[iasql_postgres_security_group]
    );

  end quickstart
$$;
