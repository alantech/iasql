do $$
<<iasql>>
  declare
    iasql_engine_port integer := 8088;
    iasql_engine_target_group text := 'iasql-engine-target-group';
    iasql_engine_load_balancer text := 'iasql-engine-load-balancer';
    iasql_engine_repository text := 'iasql-engine-repository';
    iasql_cluster text := 'iasql-cluster';
    iasql_engine_container text := 'iasql-engine-container';
    iasql_engine_task_definition text := 'iasql-engine-task-definition';
    iasql_engine_security_group text := 'iasql-engine-security-group';
    iasql_postgres_security_group text := 'iasql-postgres-security-group';
    iasql_engine_service text := 'iasql-engine-service';
    iasql_postgres_rds text := 'iasql-postgres-rds';
    iasql_engine_cloud_watch_log_group text := 'iasql-engine-log-group';
  begin

    call delete_ecs_service(iasql_engine_service);

    call delete_ecs_cluster(iasql_cluster);

    call delete_container_definition(iasql_engine_container, iasql_engine_task_definition);

    call delete_task_definition(iasql_engine_task_definition);

    call delete_cloudwatch_log_group(iasql_engine_cloud_watch_log_group);

    call delete_ecr_repository_policy(iasql_engine_repository);

    call delete_ecr_repository(iasql_engine_repository);

    call delete_aws_listener(iasql_engine_load_balancer, iasql_engine_port, 'HTTP', 'forward', iasql_engine_target_group);

    call delete_aws_load_balancer(iasql_engine_load_balancer);

    call delete_aws_target_group(iasql_engine_target_group);

    call delete_aws_security_group(iasql_engine_security_group);

    call delete_rds(iasql_postgres_rds);

    call delete_aws_security_group(iasql_postgres_security_group);

  end iasql
$$;