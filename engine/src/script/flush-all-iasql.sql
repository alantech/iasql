-- TODO: improve this script, for now only works if all tables exists

do $$
<<iasql>>
  declare
    iasql_engine_target_group text := 'iasql-engine-target-group';
    iasql_postgres_target_group text := 'iasql-postgres-target-group';
    iasql_engine_load_balancer text := 'iasql-engine-load-balancer';
    iasql_postgres_load_balancer text := 'iasql-postgres-load-balancer';
    iasql_engine_repository text := 'iasql-engine-repository';
    iasql_cluster text := 'iasql-cluster';
    iasql_engine_container text := 'iasql-engine-container';
    iasql_postgres_container text := 'iasql-postgres-container';
    iasql_engine_task_definition text := 'iasql-engine-task-definition';
    iasql_postgres_task_definition text := 'iasql-postgres-task-definition';
    iasql_engine_security_group text := 'iasql-engine-security-group';
    iasql_postgres_security_group text := 'iasql-postgres-security-group';
    iasql_engine_service text := 'iasql-engine-service';
    iasql_postgres_service text := 'iasql-postgres-service';
    iasql_postgres_rds text := 'iasql-postgres-rds';
  begin
    delete from service where name = any(array[iasql_engine_service, iasql_postgres_service]);
    delete from task_definition where family = any(array[iasql_engine_task_definition, iasql_postgres_task_definition]);
    delete from container where name = any(array[iasql_engine_container, iasql_postgres_container]);
    delete from cluster where cluster_name = iasql_cluster;
    delete from aws_listener where aws_load_balancer_id in (
      select id from aws_load_balancer where load_balancer_name = iasql_engine_load_balancer
    );
    delete from aws_action where target_group_id in (
      select id from aws_target_group where target_group_name = iasql_engine_target_group
    );
    delete from service_load_balancer where container_name = iasql_engine_container;
    delete from aws_target_group where target_group_name = iasql_engine_target_group;
    delete from aws_load_balancer where load_balancer_name = iasql_engine_load_balancer;
    delete from aws_repository_policy where aws_repository_id in (
      select id from aws_repository where repository_name = iasql_engine_repository
    );
    delete from aws_repository where repository_name = iasql_engine_repository;
    delete from rds where db_instance_identifier = iasql_postgres_rds;
    delete from aws_security_group_rule where security_group_id in (
      select id from aws_security_group where group_name = any(array[iasql_engine_security_group, iasql_postgres_security_group])
    );
    delete from aws_security_group where group_name = any(array[iasql_engine_security_group, iasql_postgres_security_group]);
  end iasql
$$;

