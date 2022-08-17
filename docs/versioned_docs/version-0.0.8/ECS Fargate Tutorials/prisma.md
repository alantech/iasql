---
sidebar_position: 2
slug: '/prisma'
---

# IaSQL on Prisma (Javascript)

In this tutorial we will use a script that uses [Prisma](https://www.prisma.io) to instrospect the schema of an IaSQL database and deploy a Node.js HTTP server within a docker container on your AWS account using Fargate ECS, IAM, ECR and ELB. The container image will be hosted as a private repository in ECR and deployed to ECS using Fargate.

The code for this tutorial lives in in this part of the [repository](https://github.com/iasql/ecs-fargate-examples/blob/main/prisma/infra/index.js)

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

1. Many different clients can be used to [connect](/connect) to a PostgreSQL database. For this tutorial, we'll use the standard `psql` CLI client. If you need to install `psql`, follow the instructions for your corresponding OS [here](https://www.postgresql.org/download/).

2. The first migration calls the `iasql_install` SQL function to install [modules](/module) into the hosted database.

```sql title="psql 'postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4' -c"
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
git filter-branch --subdirectory-filter prisma
```

2. Install the Node.js project dependencies under the `my_project/infra` folder

```bash
cd infra
npm i
```

3. Modify the [`.env file`](https://www.prisma.io/docs/guides/development-environment/environment-variables) that prisma expects with the connection parameters provided on db creation. In this case:

```bash title="my_project/infra/.env"
DATABASE_URL="postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4"
```

4. (Optional) Set the desired project name that your resources will be named after by changing the `name` in the `my_project/infra/package.json`. If the name is not changed, `quickstart` will be used.

:::note

The `project-name` can only contain alphanumeric characters and hyphens(-) because it will be used to name the load balancer

:::

5. Per the [Prisma quickstart to add an existing project](https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project/relational-databases/connect-your-database-node-postgres), create a basic `schema.prisma` file.

```json title="my_project/infra/prisma/schema.prisma"
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

6. Pull, or introspect, the schema from your database which will autopopulate the rest of the `schema.prisma` file

```
npx prisma db pull
```

7. Now install and generate the Prisma client in accordance to the introspected `schema.prisma`

```
npx prisma generate
```

:::caution

If you install or uninstall IaSQL [modules](/module) the database schema will change and you will need to run steps 5 through 7 to
introspect the correct schema once again.

:::

8. Run the existing script using the Prisma entitites

```bash
node index.js
```

This will run the following [code](https://github.com/iasql/ecs-fargate-examples/blob/main/prisma/infra/index.js)

```js title="my_project/migrations/index.js"
const { PrismaClient, load_balancer_scheme_enum, task_definition_cpu_memory_enum } = require('@prisma/client')

const pkg = require('./package.json');
// TODO replace with your desired project name
const PROJECT_NAME = pkg.name;

const CONTAINER_MEM_RESERVATION = 8192; // in MiB
const PORT = 8088;

const prisma = new PrismaClient()

async function main() {
  /* AWS SECURITY GROUPS */
  const sg = await prisma.security_group.create({
    data: {
      description: `${PROJECT_NAME} security group`, group_name: `${PROJECT_NAME}-security-group`,
    },
  });
  // TODO replace cidr with string or prisma to support cidr so we can use entity
  await prisma.$executeRawUnsafe(`
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    VALUES (false, 'tcp', ${PORT}, ${PORT}, '0.0.0.0/0', '${PROJECT_NAME}-security-group', ${sg.id});
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    VALUES (true, '-1', -1, -1, '0.0.0.0/0', '${PROJECT_NAME}-security-group', ${sg.id});
  `);

  // AWS ELASTIC LOAD BALANCER
  const tg = await prisma.target_group.create({
    data: {
      target_group_name: `${PROJECT_NAME}-target`,
      target_type: 'ip',
      protocol: 'HTTP',
      port: PORT,
      health_check_path: '/health'
    },
  });
  const lb = await prisma.load_balancer.create({
    data: {
      load_balancer_name: `${PROJECT_NAME}-load-balancer`,
      scheme: load_balancer_scheme_enum.internet_facing,
      load_balancer_type: 'application',
      ip_address_type: 'ipv4',
      load_balancer_security_groups: {
        create: {
          security_group_id: sg.id,
        }
      }
    }
  });
  const listener = await prisma.listener.create({
    data: {
      load_balancer_name: lb.load_balancer_name,
      port: PORT,
      protocol: 'HTTP',
      action_type: 'forward',
      target_group_name: tg.target_group_name,
    }
  });
  const role = await prisma.role.create({
    data: {
      role_name: `ecsTaskExecRole`,
      assume_role_policy_document: '{"Version":"2012-10-17","Statement":[{"Sid":"","Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}',
      attached_policies_arns: ['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy']
    }
  });
  const repo = await prisma.repository.create({
    data: { repository_name: `${PROJECT_NAME}-repository`}
  });
  const logGroup = await prisma.log_group.create({
    data: { log_group_name: `${PROJECT_NAME}-log-group`}
  });
  const cluster = await prisma.cluster.create({
    data: { cluster_name: `${PROJECT_NAME}-cluster`}
  });
  // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
  const task = await prisma.task_definition.create({
    data: {
      family: `${PROJECT_NAME}-td`, cpu_memory: task_definition_cpu_memory_enum.vCPU2_8GB,
      task_role_name: role.role_name, execution_role_name: role.role_name,
    }
  });
  const container = await prisma.container_definition.create({
    data: {
      name: `${PROJECT_NAME}-container`, essential: true,
      log_group_name: logGroup.log_group_name,
      repository_name: repo.repository_name, task_definition_id: task.id, tag: 'latest',
      memory_reservation: CONTAINER_MEM_RESERVATION,
      host_port: PORT, container_port: PORT, protocol: 'tcp',
    }
  });
  // select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true limit 3),
  const vpc_res = await prisma.vpc.findFirst({
    where: { is_default: true },
    select: {
      subnet: {
        select: {
          subnet_id: true
        }
      }
    }
  });
  const subnet_ids = vpc_res.subnet.map(s => s.subnet_id);
  // create ECS service and associate it to security group
  const service = await prisma.service.create({
    data: {
      name: `${PROJECT_NAME}-service`, desired_count: 1, assign_public_ip: 'ENABLED',
      cluster_name: cluster.cluster_name, task_definition_id: task.id, target_group_name: tg.target_group_name,
      subnets: subnet_ids,
      service_security_groups: {
        create: {
          security_group_id: sg.id,
        }
      }
    }
  });
}
```

The last part of the script will apply the changes described in the hosted db to your cloud account which will take a few minutes waiting for AWS

```js title="my_project/migrations/index.js"
const apply = await prisma.$queryRaw`SELECT * from iasql_apply();`
console.dir(apply)
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
QUICKSTART_LB_DNS=$(psql -At 'postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4' -c "
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
