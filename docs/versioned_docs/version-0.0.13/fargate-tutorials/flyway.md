---
sidebar_position: 2
slug: '/flyway'
---

# IaSQL on Flyway (SQL)

In this tutorial we will run [Flyway SQL migrations](https://flywaydb.org/documentation/concepts/migrations) on top of IaSQL to deploy a Node.js HTTP server within a docker container on your AWS account using Fargate ECS, IAM, ECR and ELB. The container image will be hosted as a private repository in ECR and deployed to ECS using Fargate.

The code for this tutorial lives in this part of the [repository](https://github.com/iasql/ecs-fargate-examples/blob/main/flyway/migrations/V2__init.sql)

## Start managing an AWS account with a hosted IaSQL db

First, make sure you have an [IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html) in AWS or create one with **Programmatic access** through the [console/UI](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html#id_users_create_console) or [CLI](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html#id_users_create_cliwpsapi). Ensure that the IAM role has sufficient permissions to deploy and manage all your infrastructure resources.

There are two parts to each [access key](https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html#access-keys-and-secret-access-keys), which you’ll see in the IAM console/CLI after you create it, an id and a secret. Input these in the connect account modal:

<img width={440} src={require('@site/static/screenshots/connect-manual.png').default} />

If you use the [AWS CLI](https://docs.aws.amazon.com/cli/), you can look at the [credentials configured locally](https://docs.aws.amazon.com/sdkref/latest/guide/file-location.html). In macOS and Linux this is as simple as:

```bash
$ cat ~/.aws/credentials
[default]
aws_access_key_id = <YOUR_ACCESS_KEY_ID>
aws_secret_access_key = <YOUR_SECRET_ACCESS_KEY>
```
You will be able to see your PostgreSQL connection information when you press Connect.

<img width={440} src={require('@site/static/screenshots/credentials.png').default} />

Make sure to copy the PostgreSQL connection string as you will not see it again.

## Add the necessary cloud services to the hosted database

1. Many different clients can be used to [connect](../how-to/connect.md) to a PostgreSQL database. For this tutorial, we'll use the standard `psql` CLI client. If you need to install `psql`, follow the instructions for your corresponding OS [here](https://www.postgresql.org/download/).

2. The first migration calls the `iasql_install` SQL function to install [modules](../concepts/module.md) into the hosted database.

```sql title="my_project/migrations/V1__install.sql"
SELECT * from iasql_install(
   'aws_iam',
   'aws_cloudwatch',
   'aws_ecr',
   'aws_ecs_fargate',
   'aws_elb',
   'aws_security_group',
   'aws_vpc'
);
```

If the function call is successful, it will return a virtual table with a record for each new table in your database under `created_table_name` and the number of existing resources or records imported from the account under `record_count`.

```sql
       module_name        |      created_table_name       | record_count
--------------------------+-------------------------------+--------------
 aws_cloudwatch@0.0.1     | log_group                     |            0
 aws_iam@0.0.1            | role                          |            0
 aws_ecr@0.0.1            | public_repository             |            0
 aws_ecr@0.0.1            | repository                    |            1
 aws_ecr@0.0.1            | repository_policy             |            0
 aws_security_group@0.0.1 | security_group                |            2
 aws_security_group@0.0.1 | security_group_rule           |            0
 aws_vpc@0.0.1            | vpc                           |            1
 aws_vpc@0.0.1            | subnet                        |            3
 aws_elb@0.0.1            | load_balancer                 |            0
 aws_elb@0.0.1            | target_group                  |            0
 aws_elb@0.0.1            | listener                      |            0
 aws_elb@0.0.1            | load_balancer_security_groups |            0
 aws_ecs_fargate@0.0.1    | cluster                       |            0
 aws_ecs_fargate@0.0.1    | service                       |            0
 aws_ecs_fargate@0.0.1    | task_definition               |            0
 aws_ecs_fargate@0.0.1    | container_definition          |            0
 aws_ecs_fargate@0.0.1    | service_security_groups       |            0
(17 rows)
```

## Connect to the hosted db and provision cloud resources in your AWS account

1. Get a local copy of the [ECS Fargate examples repository](https://github.com/iasql/ecs-fargate-examples)

```bash
git clone git@github.com:iasql/ecs-fargate-examples.git my_project
cd my_project
git filter-branch --subdirectory-filter flyway
```

2. Install the Node.js project dependencies under the `my_project/infra` folder

```bash
cd infra
npm i
```

3. Create a [`flyway.conf`](https://flywaydb.org/documentation/configuration/configfile) with the connection parameters provided on db creation. In this case:

```bash title="my_project/flyway.conf" {1-4}
flyway.url=jdbc:postgresql://db.iasql.com/_4b2bb09a59a411e4
flyway.user=d0va6ywg
flyway.password=nfdDh#EP4CyzveFr
flyway.locations=filesystem:migrations
flyway.failOnMissingLocations=true

# Run all migrations by seting the baseline version for v0
# https://flywaydb.org/documentation/configuration/parameters/baselineVersion
flyway.baselineVersion=0.0
flyway.baselineOnMigrate=true
flyway.validateMigrationNaming=true
# Flyway supports placeholder replacement with configurable prefixes and suffixes.
# By default it looks for Ant-style placeholders like ${myplaceholder} in SQL syntax
flyway.placeholders.region=us-east-2
flyway.placeholders.project_name=quickstart
flyway.placeholders.task_def_resources=vCPU2-8GB
flyway.placeholders.image_tag=latest
flyway.placeholders.container_mem_reservation=8192
flyway.placeholders.port=8088
```

4. (Optional) Set the desired project name that your resources will be named after by changing `flyway.placeholders.projectName` in `my_project/flyway.conf`. If the name is not changed, `quickstart` will be used.

:::note

The `project-name` can only contain alphanumeric characters and hyphens(-) because it will be used to name the load balancer

:::

5. Install the `flyway` CLI following the [corresponding instructions](https://flywaydb.org/documentation/usage/commandline/) for your OS

6. Run the existing Flyway migrations on the hosted IaSQL db by invoking the `flyway` CLI

```bash
flyway migrate
```

7. The [second migration](https://github.com/iasql/ecs-fargate-examples/blob/main/flyway/migrations/V2__init.sql) will run the following SQL code. Flyway supports placeholder replacement with configurable prefixes and suffixes. By default it looks for Ant-style placeholders like `${myplaceholder}` in SQL syntax

```sql title="my_project/migrations/V2__init.sql"
-- we use transactions to make sure we don't leave cruft behind in case an insert fails
-- make sure the correct iasql modules are installed or the tables won't exist

-- AWS SECURITY GROUPS
BEGIN;
  INSERT INTO security_group (description, group_name)
  VALUES ('${project_name} security group', '${project_name}-security-group');

  INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
  SELECT false, 'tcp', ${port}, ${port}, '0.0.0.0/0', '${project_name}-security-group', id
  FROM security_group
  WHERE group_name = '${project_name}-security-group';

  INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
  SELECT true, '-1', -1, -1, '0.0.0.0/0', '${project_name}-security-group', id
  FROM security_group
  WHERE group_name = '${project_name}-security-group';
COMMIT;

-- AWS ELASTIC LOAD BALANCER
BEGIN;
  INSERT INTO target_group
      (target_group_name, target_type, protocol, port, health_check_path)
  VALUES
      ('${project_name}-target', 'ip', 'HTTP', ${port}, '/health');

  INSERT INTO load_balancer
      (load_balancer_name, scheme, load_balancer_type, ip_address_type)
  VALUES
      ('${project_name}-load-balancer', 'internet-facing', 'application', 'ipv4');

  INSERT INTO load_balancer_security_groups
      (load_balancer_name, security_group_id)
  VALUES
      ('${project_name}-load-balancer',
        (SELECT id FROM security_group WHERE group_name = '${project_name}-security-group' LIMIT 1)
      );

  INSERT INTO listener
      (load_balancer_name, port, protocol, action_type, target_group_name)
  VALUES
      ('${project_name}-load-balancer',
        ${port}, 'HTTP', 'forward', '${project_name}-target');
COMMIT;

-- ELASTIC CONTAINER REPOSITORY (ECR) + ELASTIC CONTAINER SERVICE (ECS) + CLOUDWATCH
-- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
BEGIN;
  INSERT INTO log_group (log_group_name) VALUES ('${project_name}-log-group');

  INSERT INTO repository (repository_name) VALUES ('${project_name}-repository');

  INSERT INTO cluster (cluster_name) VALUES('${project_name}-cluster');

  INSERT INTO role (role_name, assume_role_policy_document, attached_policies_arns)
  VALUES ('ecsTaskExecRole${region}', '{"Version":"2012-10-17","Statement":[{"Sid":"","Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}', array['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy']);

  INSERT INTO task_definition ("family", task_role_name, execution_role_name, cpu_memory)
  VALUES ('${project_name}-td', 'ecsTaskExecRole${region}', 'ecsTaskExecRole${region}', '${task_def_resources}');

  INSERT INTO container_definition ("name", essential, repository_name, task_definition_id, tag, memory_reservation, host_port, container_port, protocol, log_group_name)
  VALUES (
    '${project_name}-container', true,
    '${project_name}-repository',
    (select id from task_definition where family = '${project_name}-td' and status is null limit 1),
    '${image_tag}', ${container_mem_reservation}, ${port}, ${port}, 'tcp', '${project_name}-log-group'
  );
COMMIT;

-- create ECS service and associate it to security group
BEGIN;
  INSERT INTO service ("name", desired_count, assign_public_ip, subnets, cluster_name, task_definition_id, target_group_name)
  VALUES (
    '${project_name}-service', 1, 'ENABLED',
    (select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true limit 3)),
    '${project_name}-cluster',
    (select id from task_definition where family = '${project_name}-td' order by revision desc limit 1),
    '${project_name}-target'
  );

  INSERT INTO service_security_groups (service_name, security_group_id)
  VALUES (
    '${project_name}-service',
    (select id from security_group where group_name = '${project_name}-security-group' limit 1)
  );
COMMIT;
```

Finally, it will apply the changes described in the hosted db to your cloud account which will take a few minutes waiting for AWS

```sql title="my_project/migrations/V2__init.sql"
SELECT * from iasql_apply();
```

If the function call is successful, it will return a virtual table with a record for each cloud resource that has been created, deleted or updated.

```sql
 action |    table_name       |   id   |      description      
--------+---------------------+--------+-----------------------
 create | public_repository   |      2 | quickstart-repository
 create | cluster             |      2 | 2
 create | task_definition     |      2 | 2
 create | service             |      2 | 2
 create | listener            |      2 | 2
 create | load_balancer       |      2 | 2
 create | target_group        |      2 | 2
 create | security_group      |      5 | 5
 create | security_group_rule |      3 | 3
 create | security_group_rule |      4 | 4
 create | role                |        | ecsTaskExecRole
```

## Login, build and push your code to the container registry

1. Grab your new `ECR URI` from the hosted DB
```bash
QUICKSTART_ECR_URI=$(psql -At 'postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4' -c "
SELECT repository_uri
FROM repository
WHERE repository_name = '<project-name>-repository';")
```

2. Login to AWS ECR using the AWS CLI. Run the following command and using the correct `<ECR-URI>` and AWS `<profile>`

```bash
aws ecr get-login-password --region ${AWS_REGION} --profile <profile> | docker login --username AWS --password-stdin ${QUICKSTART_ECR_URI}
```

3. Build your image locally

```bash
docker build -t <project-name>-repository app
```

4. Tag your image

```bash
docker tag <project-name>-repository:latest ${QUICKSTART_ECR_URI}:latest
```

5. Push your image

```bash
docker push ${QUICKSTART_ECR_URI}:latest
```

6. Grab your load balancer DNS and access your service!
```bash
QUICKSTART_LB_DNS=$(psql -At postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4 -c "
SELECT dns_name
FROM load_balancer
WHERE load_balancer_name = '<project-name>-load-balancer';")
```

7. Connect to your service!

```
curl ${QUICKSTART_LB_DNS}:8088/health
```

## Delete managed cloud resources

:::warning

If you did not create a new account this section will delete **all** records managed by IaSQL, including the ones that previously existed in the account under any of the used modules. Run `SELECT * FROM iasql_plan_apply()` after `SELECT delete_all_records();` and before `SELECT iasql_apply();` to get a preview of what would get deleted. To undo `SELECT delete_all_records();`, simply run `SELECT iasql_sync();` which will synchronize the database with the cloud's state.

:::

1. Delete all the docker images in the repository

```bash
aws ecr batch-delete-image \
      --region ${AWS_REGION} \
      --repository-name <project-name>-repository \
      --profile <profile> \
      --image-ids imageTag=latest
```

2. Delete all iasql records invoking the void `delete_all_records` function:

```sql title="psql 'postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4' -c"
SELECT delete_all_records();
```

3. Apply the changes described in the hosted db to your cloud account

```sql title="psql 'postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4' -c"
SELECT * from iasql_apply();
```

If the function call is successful, it will return a virtual table with a record for each cloud resource that has been created, deleted or updated.

```sql
 action |     table_name      |   id   |                                                         description                                                         
--------+---------------------+--------+-----------------------------------------------------------------------------------------------------------------------------
 delete | cluster             | [NULL] | arn:aws:ecs:sa-east-1:658401754851:cluster/quickstart-cluster
 delete | task_definition     | [NULL] | arn:aws:ecs:sa-east-1:658401754851:task-definition/quickstart-td:1
 delete | service             | [NULL] | arn:aws:ecs:sa-east-1:658401754851:service/quickstart-cluster/quickstart-service
 delete | listener            | [NULL] | arn:aws:elasticloadbalancing:sa-east-1:658401754851:listener/app/quickstart-load-balancer/3925cdb9acada7c1/7a459d6259dac5c9
 delete | load_balancer       | [NULL] | arn:aws:elasticloadbalancing:sa-east-1:658401754851:loadbalancer/app/quickstart-load-balancer/3925cdb9acada7c1
 delete | target_group        | [NULL] | arn:aws:elasticloadbalancing:sa-east-1:658401754851:targetgroup/quickstart-target/826f804f496d0a90
 delete | security_group      | [NULL] | sg-0015b0e07bd10b7d2
 delete | security_group      | [NULL] | sg-e0df1095
 delete | security_group_rule | [NULL] | sgr-06aa0915b15fd23a9
 delete | security_group_rule | [NULL] | sgr-02e2096ac9e77a5bf
 delete | role                | [NULL] | ecsTaskExecRole

```
