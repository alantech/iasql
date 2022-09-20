---
sidebar_position: 2
slug: '/prisma'
---

# IaSQL on Prisma (Javascript)

In this tutorial, we will use a script that uses [Prisma](https://www.prisma.io) to introspect the schema of an IaSQL database and deploy a Node.js HTTP server within a docker container on your AWS account using Fargate ECS, IAM, ECR and ELB. The container image will be hosted as a private repository in ECR and deployed to ECS using Fargate.

The code for this tutorial lives in this part of the [repository](https://github.com/iasql/iasql-engine/tree/main/examples/ecs-fargate/prisma/infra/index.js)

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

Use the `iasql_install` SQL function to install [modules](../concepts/module.md) into the hosted database.

```sql
SELECT * from iasql_install(
  'aws_ecs_simplified'
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
 aws_ecs_simplified       | ecs_simplified                |            0
(17 rows)
```

## Connect to the hosted db and provision cloud resources in your AWS account

1. Get a local copy of the [ECS Fargate examples code](https://github.com/iasql/iasql-engine/tree/main/examples/ecs-fargate/prisma)

2. Install the Node.js project dependencies under the `prisma/infra` folder

```bash
cd infra
npm i
```

3. Modify the [`.env file`](https://www.prisma.io/docs/guides/development-environment/environment-variables) that Prisma expects with the connection parameters provided on db creation. In this case:

```bash title="prisma/infra/.env"
DATABASE_URL="postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4"
```

4. (Optional) Set the desired project name that your resources will be named after by changing the `name` in the `my_project/infra/package.json`. If the name is not changed, `quickstart` will be used.

:::note

The `project-name` can only contain alphanumeric characters and hyphens(-) because it will be used to name the load balancer

:::

5. Per the [Prisma quickstart to add an existing project](https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project/relational-databases/connect-your-database-node-postgres), create a basic `schema.prisma` file.

```json title="prisma/infra/prisma/schema.prisma"
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

6. Pull, or introspect, the schema from your database which will auto-populate the rest of the `schema.prisma` file

```
npx prisma db pull
```

7. Now install and generate the Prisma client by the introspected `schema.prisma`

```
npx prisma generate
```

:::caution

If you install or uninstall IaSQL [modules](../concepts/module.md) the database schema will change and you will need to run steps 5 through 7 to
introspect the correct schema once again.

:::

8. Run the existing script using the Prisma entities

```bash
node index.js
```

This will run the following [code](https://github.com/iasql/iasql-engine/tree/main/examples/ecs-fargate/prisma/infra/index.js)

```js title="my_project/migrations/index.js"
const { PrismaClient, load_balancer_scheme_enum, task_definition_cpu_memory_enum } = require('@prisma/client')

const pkg = require('./package.json');
// TODO replace with your desired project name
const PROJECT_NAME = pkg.name;

const CONTAINER_MEM_RESERVATION = 8192; // in MiB
const PORT = 8088;

const prisma = new PrismaClient()

async function main() {
  const data = {
    app_name: PROJECT_NAME, public_ip: true, app_port: PORT
  };
  await prisma.ecs_simplified.upsert({
    where: { app_name: PROJECT_NAME},
    create: data,
    update: data,
  });

  const apply = await prisma.$queryRaw`SELECT * from iasql_apply();`
  console.dir(apply)

  const repo_uri = (await prisma.ecs_simplified.findFirst({
    where: { app_name: PROJECT_NAME },
    select: { repository_uri: true }
  })).repository_uri;

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

2. Login to AWS ECR using the AWS CLI. Run the following command and use the correct `<ECR-URI>` and AWS `<profile>`

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

Delete all iasql records invoking the void `delete_all_records` function and apply the changes described in the hosted db to your cloud account:

```sql
SELECT delete_all_records();

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
