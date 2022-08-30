---
sidebar_position: 1
slug: '/typeorm'
---

# IaSQL on TypeORM (SQL ORM)

In this tutorial, we will run [TypeORM SQL migrations](https://typeorm.io/#/migrations) on top of IaSQL to deploy a Node.js HTTP server within a docker container on your AWS account using Fargate ECS, IAM, ECR and ELB. The container image will be hosted as a private repository in ECR and deployed to ECS using Fargate.

The code for this tutorial can be found in this part of the [repository](https://github.com/iasql/ecs-fargate-examples/blob/main/typeorm/infra/src/migration/1646683871219-Initial.js)

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

2. The `up` part of the first migration calls the `iasql_install` SQL function to install [modules](../concepts/module.md) into the hosted database.

```sql title="my_project/infra/src/migration/1646683871211-Install.js"
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
 aws_cloudwatch           | log_group                     |            0
 aws_iam                  | role                          |            0
 aws_ecr                  | public_repository             |            0
 aws_ecr                  | repository                    |            1
 aws_ecr                  | repository_policy             |            0
 aws_security_group       | security_group                |            2
 aws_security_group       | security_group_rule           |            0
 aws_vpc                  | vpc                           |            1
 aws_vpc                  | subnet                        |            3
 aws_elb                  | load_balancer                 |            0
 aws_elb                  | target_group                  |            0
 aws_elb                  | listener                      |            0
 aws_elb                  | load_balancer_security_groups |            0
 aws_ecs_fargate          | cluster                       |            0
 aws_ecs_fargate          | service                       |            0
 aws_ecs_fargate          | task_definition               |            0
 aws_ecs_fargate          | container_definition          |            0
 aws_ecs_fargate          | service_security_groups       |            0
(17 rows)
```

## Connect to the hosted db and provision cloud resources in your AWS account

1. Get a local copy of the [ECS Fargate examples repository](https://github.com/iasql/ecs-fargate-examples)

```bash
git clone git@github.com:iasql/ecs-fargate-examples.git my_project
cd my_project
git filter-branch --subdirectory-filter typeorm
```

2. Install the Node.js project dependencies under the `my_project/infra` folder

```bash
cd infra
npm i
```

3. (Optional) Set the desired project name that your resources will be named after by changing the `name` in the `my_project/infra/package.json`. If the name is not changed, `quickstart` will be used.

:::note

The `project-name` can only contain alphanumeric characters and hyphens(-) because it will be used to name the load balancer

:::

3. Create a [`ormconfig.json`](https://typeorm.io/#/using-ormconfig/using-ormconfigjson) with the connection parameters provided on db creation. In this case:

```json title="my_project/infra/ormconfig.json" {2-7}
{
   "type": "postgres",
   "host": "db.iasql.com",
   "username": "d0va6ywg",
   "password": "nfdDh#EP4CyzveFr",
   "database": "_4b2bb09a59a411e4",
   "ssl": true,
   "extra": {
      "ssl": {
         "rejectUnauthorized": false
      }
   },
   "logging": false,
   "migrations": [
      "src/migration/**/*.js"
   ],
   "cli": {
      "migrationsDir": "src/migration"
   }
}
```

4. Run the existing TypeORM migrations on the hosted IaSQL db by invoking `typeorm` CLI

```bash
npx typeorm migration:run
```

5. The `up` part of the second, and last, migration will run the following [code](https://github.com/iasql/ecs-fargate-examples/blob/main/typeorm/infra/src/migration/1646683871219-Initial.js):

```js title="my_project/infra/1646683871219-Initial.js"
const pkg = require('../../package.json');
// TODO replace with your desired project name
const PROJECT_NAME = pkg.name;

// AWS ELASTIC CONTAINER REPOSITORY (ECR)
const region = !process.env.AWS_REGION ? '' : `-${process.env.AWS_REGION}`;
const REPOSITORY = `${PROJECT_NAME}-repository`;

// AWS IAM
const TASK_ROLE_NAME = `ecsTaskExecRole-${region}`;
const TASK_ASSUME_POLICY = JSON.stringify({
  "Version": "2012-10-17",
  "Statement": [
      {
          "Sid": "",
          "Effect": "Allow",
          "Principal": {
              "Service": "ecs-tasks.amazonaws.com"
          },
          "Action": "sts:AssumeRole"
      }
  ]
});
const TASK_POLICY_ARN = 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy';

// AWS CLOUDWATCH
const LOG_GROUP = `${PROJECT_NAME}-log-group`

// AWS FARGATE + ELASTIC CONTAINER SERVICE (ECS)
// https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
const TASK_DEF_RESOURCES = 'vCPU2-8GB'; // task_definition_cpu_memory enum
const TASK_DEF_FAMILY = `${PROJECT_NAME}-td`;
const SERVICE_DESIRED_COUNT = 1;
const IMAGE_TAG = 'latest';
const CONTAINER = `${PROJECT_NAME}-container`;
const CONTAINER_MEM_RESERVATION = 8192; // in MiB
const PROTOCOL = 'TCP';
const CLUSTER = `${PROJECT_NAME}-cluster`;
const SERVICE = `${PROJECT_NAME}-service`;

// AWS SECURITY GROUP + VPC
const SECURITY_GROUP = `${PROJECT_NAME}-security-group`;
const PORT = 8088;

// AWS ELASTIC LOAD BALANCER
const TARGET_GROUP = `${PROJECT_NAME}-target`;
const LOAD_BALANCER = `${PROJECT_NAME}-load-balancer`;

module.exports = class Initial1646683871219 {

  async up(queryRunner) {
    // security group
    await queryRunner.query(`
      BEGIN;
        INSERT INTO security_group (description, group_name)
        VALUES ('${PROJECT_NAME} security group', '${SECURITY_GROUP}');

        INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
        SELECT false, 'tcp', ${PORT}, ${PORT}, '0.0.0.0/0', '${SECURITY_GROUP}', id
        FROM security_group
        WHERE group_name = '${SECURITY_GROUP}';

        INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
        SELECT true, '-1', -1, -1, '0.0.0.0/0', '${SECURITY_GROUP}', id
        FROM security_group
        WHERE group_name = '${SECURITY_GROUP}';
      COMMIT;
    `);

    // load balancer
    await queryRunner.query(`
      BEGIN;
        INSERT INTO target_group
            (target_group_name, target_type, protocol, port, health_check_path)
        VALUES
            ('${TARGET_GROUP}', 'ip', 'HTTP', ${PORT}, '/health');

        INSERT INTO load_balancer
            (load_balancer_name, scheme, load_balancer_type, ip_address_type)
        VALUES
            ('${LOAD_BALANCER}', 'internet-facing', 'application', 'ipv4');

        INSERT INTO load_balancer_security_groups
            (load_balancer_name, security_group_id)
        VALUES
            ('${LOAD_BALANCER}',
              (SELECT id FROM security_group WHERE group_name = '${SECURITY_GROUP}' LIMIT 1));

        INSERT INTO listener
            (load_balancer_name, port, protocol, action_type, target_group_name)
        VALUES
            ('${LOAD_BALANCER}',
              ${PORT}, 'HTTP', 'forward', '${TARGET_GROUP}');
      COMMIT;
    `);

    // container (ECR + ECS)
    await queryRunner.query(`
      BEGIN;
        INSERT INTO log_group (log_group_name) VALUES ('${LOG_GROUP}');

        INSERT INTO repository (repository_name) VALUES ('${REPOSITORY}');

        INSERT INTO cluster (cluster_name) VALUES('${CLUSTER}');

        INSERT INTO role (role_name, assume_role_policy_document, attached_policies_arns)
        VALUES ('${TASK_ROLE_NAME}', '${TASK_ASSUME_POLICY}', array['${TASK_POLICY_ARN}']);

        INSERT INTO task_definition ("family", task_role_name, execution_role_name, cpu_memory)
        VALUES ('${TASK_DEF_FAMILY}', '${TASK_ROLE_NAME}', '${TASK_ROLE_NAME}', '${TASK_DEF_RESOURCES}');

        INSERT INTO container_definition ("name", essential, repository_name, task_definition_id, tag, memory_reservation, host_port, container_port, protocol, log_group_name)
        VALUES (
          '${CONTAINER}', true,
          '${REPOSITORY}',
          (select id from task_definition where family = '${TASK_DEF_FAMILY}' and status is null limit 1),
          '${IMAGE_TAG}', ${CONTAINER_MEM_RESERVATION}, ${PORT}, ${PORT}, '${PROTOCOL.toLowerCase()}', '${LOG_GROUP}'
        );
      COMMIT;
    `);

    // create ECS service and associate it to security group
    await queryRunner.query(`
      BEGIN;
        INSERT INTO service ("name", desired_count, assign_public_ip, subnets, cluster_name, task_definition_id, target_group_name)
        VALUES (
          '${SERVICE}', ${SERVICE_DESIRED_COUNT}, 'ENABLED',
          (select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true limit 3)),
          '${CLUSTER}',
          (select id from task_definition where family = '${TASK_DEF_FAMILY}' order by revision desc limit 1),
          '${TARGET_GROUP}'
        );

        INSERT INTO service_security_groups (service_name, security_group_id)
        VALUES (
          '${SERVICE}',
          (select id from security_group where group_name = '${SECURITY_GROUP}' limit 1)
        );
      COMMIT;
    `);

    // apply the changes
    await queryRunner.query(`
      SELECT * FROM iasql_apply();
    `);
  }

  // order matters
  async down(queryRunner) {
    // delete ECS service
    await queryRunner.query(`
      BEGIN;
        DELETE FROM service_security_groups
        USING service
        WHERE name = '${SERVICE}';

        DELETE FROM service WHERE name = '${SERVICE}';
      COMMIT;
    `);

    // delete ECS + ECR
    await queryRunner.query(`
      BEGIN;
        DELETE FROM container_definition
        USING task_definition
        WHERE container_definition.task_definition_id = task_definition.id and task_definition.family = '${TASK_DEF_FAMILY}';

        DELETE FROM task_definition WHERE family = '${TASK_DEF_FAMILY}';

        DELETE FROM role WHERE role_name = '${TASK_ROLE_NAME}';

        DELETE FROM cluster WHERE cluster_name = '${CLUSTER}';

        DELETE FROM repository WHERE repository_name = '${REPOSITORY}';

        DELETE FROM log_group WHERE log_group_name = '${LOG_GROUP}';
      COMMIT;
    `);

    // delete ELB
    await queryRunner.query(`
      BEGIN;
        DELETE FROM listener
        WHERE load_balancer_name = '${LOAD_BALANCER}' AND target_group_name = '${TARGET_GROUP}';

        DELETE FROM load_balancer_security_groups
        WHERE load_balancer_name = '${LOAD_BALANCER}';

        DELETE FROM load_balancer
        WHERE load_balancer_name = '${LOAD_BALANCER}';

        DELETE FROM target_group
        WHERE target_group_name = '${TARGET_GROUP}';
      COMMIT;
    `);

    // delete security groups
    await queryRunner.query(`
      BEGIN;
        DELETE FROM security_group_rule
        USING security_group
        WHERE security_group.id = security_group_rule.security_group_id AND security_group.group_name = '${SECURITY_GROUP}';

        DELETE FROM security_group WHERE group_name = '${SECURITY_GROUP}';
      COMMIT;
    `);
  }
}
```

The last part of the migration will apply the changes described in the hosted db to your cloud account which will take a few minutes waiting for AWS

```sql title="my_project/infra/1646683871219-Initial.js"
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
```

## Login, build and push your code to the container registry

1. Grab your new `ECR URI` from the hosted DB
```bash
QUICKSTART_ECR_URI=$(psql -At postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4 -c "
SELECT repository_uri
FROM repository
WHERE repository_name = '<project-name>-repository';")
```

2. Login to AWS ECR using the AWS CLI. Run the following command and using the correct `<ECR-URI>` and AWS `<profile>`

```bash
aws ecr get-login-password --region ${AWS_REGION} --profile <profile> | docker login --username AWS --password-stdin ${QUICKSTART_ECR_URI}
```

:::caution

Make sure the [CLI is configured with the same credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html), via environment variables or `~/.aws/credentials`, as the ones provided to IaSQL or this will fail.

:::

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

## Clean up the created cloud resources

1. Delete all the docker images in the repository

```bash
aws ecr batch-delete-image \
      --repository-name <project-name>-repository \
      --profile <profile> \
      --image-ids imageTag=latest
```

:::caution

Make sure the [CLI is configured with the same credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html), via environment variables or `~/.aws/credentials`, as the ones provided to IaSQL or this will fail.

:::

2. Reverse the latest migration, which in this case only requires invoking the following command once:

```bash
npx typeorm migration:revert
```

3. The `down` part of the second, and last, migration is called which reverts the changes and calls the `iasql_apply` function:

```sql title="my_project/infra/1646683871219-Initial.js"
...
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