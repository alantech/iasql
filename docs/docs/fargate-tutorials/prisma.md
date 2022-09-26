---
sidebar_position: 2
slug: '/prisma'
---

# IaSQL on Prisma (Javascript)

In this tutorial, we will use a script that uses [Prisma](https://www.prisma.io) to introspect the schema of an IaSQL database and deploy a Node.js HTTP server within a docker container on your AWS account using Fargate ECS, CodeBuild, IAM, ECR, and ELB. The container image will be built in CodeBuild, hosted within a private repository in ECR, and deployed to ECS using Fargate.

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
  'aws_ecs_simplified',
  'aws_codebuild'
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
 aws_codebuild            | codebuild_build_list          |            0
 aws_codebuild            | codebuild_build_import        |            0
 aws_codebuild            | codebuild_project             |            0
 aws_codebuild            | source_credentials_list       |            0
 aws_codebuild            | source_credentials_import     |            0
(17 rows)
```

## Connect to the hosted IaSQL db, provision cloud resources in your AWS account, and deploy your app

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
const { PrismaClient } = require('@prisma/client');

const pkg = require('./package.json');

// TODO replace with your desired project name
const appName = pkg.name;
const cbRole = `${appName}codebuild`;
const ghToken = process.env.GH_PAT;
const region = process.env.AWS_REGION;
const port = 8088;
const codebuildPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess';
const cloudwatchLogsArn = 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess';
// TODO provide ECR permissions once inline policies are supported in roles
const pushEcrPolicyArn = 'arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilderECRContainerBuilds';
const assumeServicePolicy = {
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "codebuild.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    },
  ],
  "Version": "2012-10-17"
};
const ghUrl = 'https://github.com/iasql/iasql-engine';

const prisma = new PrismaClient()

async function main() {
  const ecsData = {
    app_name: appName,
    public_ip: true,
    app_port: port,
    image_tag: 'latest'
  };
  await prisma.ecs_simplified.upsert({
    where: { app_name: appName},
    create: ecsData,
    update: ecsData,
  });

  console.dir(await prisma.$queryRaw`SELECT * from iasql_apply();`)

  await prisma.source_credentials_import.create({
    data: {
      token: ghToken,
      source_type: 'GITHUB',
      auth_type: 'PERSONAL_ACCESS_TOKEN',
    }
  })

  const repoUri = (await prisma.ecs_simplified.findFirst({
    where: { app_name: appName },
    select: { repository_uri: true }
  })).repository_uri;

  const cbData = {
    role_name: cbRole,
    assume_role_policy_document: assumeServicePolicy,
    attached_policies_arns: [codebuildPolicyArn, cloudwatchLogsArn, pushEcrPolicyArn]
  }
  await prisma.role.upsert({
    where: { role_name: cbRole },
    create: cbData,
    update: cbData,
  });

  const buildSpec = `
    version: 0.2

    phases:
      pre_build:
        commands:
          - echo Logging in to Amazon ECR...
          - aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${repoUri}
      build:
        commands:
          - echo Building the Docker image...
          - docker build -t ${appName}-repository examples/ecs-fargate/prisma/app
          - docker tag ${appName}-repository:latest ${repoUri}:latest
      post_build:
        commands:
          - echo Pushing the Docker image...
          - docker push ${repoUri}:latest
  `;

  const pjData = {
    project_name: appName,
    source_type: 'GITHUB',
    service_role_name: cbRole,
    source_location: ghUrl,
    build_spec: buildSpec,
  };
  await prisma.codebuild_project.upsert({
    where: { project_name: appName},
    create: pjData,
    update: pjData,
  });
  await prisma.codebuild_build_import.create({
    data: {
      project_name: appName,
    }
  });

  console.dir(await prisma.$queryRaw`SELECT * from iasql_apply();`)
}
```

The two `SELECT * from iasql_apply();` queries will apply the changes described in the hosted db to your cloud account which can take a few minutes waiting for AWS and print arrays of javascript objects with the cloud resources that have been created, deleted, or updated.

```javascript
[
  {
    action: 'create',
    table_name: 'log_group',
    id: '',
    description: 'quickstart-log-group'
  },
  {
    action: 'create',
    table_name: 'repository',
    id: '',
    description: 'quickstart-repository'
  },
  {
    action: 'create',
    table_name: 'role',
    id: '',
    description: 'quickstart-ecs-task-exec-role'
  },
  {
    action: 'create',
    table_name: 'security_group',
    id: '16',
    description: '16'
  },
  {
    action: 'create',
    table_name: 'security_group_rule',
    id: '15',
    description: '15'
  },
  {
    action: 'create',
    table_name: 'security_group_rule',
    id: '16',
    description: '16'
  },
  {
    action: 'create',
    table_name: 'listener',
    id: '8',
    description: '8'
  },
  {
    action: 'create',
    table_name: 'load_balancer',
    id: '',
    description: 'quickstart-load-balancer'
  },
  {
    action: 'create',
    table_name: 'target_group',
    id: '',
    description: 'quickstart-target'
  },
  {
    action: 'create',
    table_name: 'cluster',
    id: '',
    description: 'quickstart-cluster'
  },
  {
    action: 'create',
    table_name: 'task_definition',
    id: '8',
    description: '8'
  },
  {
    action: 'create',
    table_name: 'service',
    id: '',
    description: 'quickstart-service'
  },
]
```

Now grab your load balancer DNS and access your service!
```bash
QUICKSTART_LB_DNS=$(psql -At 'postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4' -c "
SELECT dns_name
FROM load_balancer
WHERE load_balancer_name = '<project-name>-load-balancer';")

curl ${QUICKSTART_LB_DNS}:8088/health
```

## Delete managed cloud resources

:::warning

If you did not create a new AWS account this section will delete **all** records managed by IaSQL, including the ones that previously existed in the account under any of the used modules. Run `SELECT * FROM iasql_plan_apply()` after `SELECT delete_all_records();` and before `SELECT iasql_apply();` to get a preview of what would get deleted. To undo `SELECT delete_all_records();`, simply run `SELECT iasql_sync();` which will synchronize the database with the cloud's state.

:::

Delete all records invoking the void `delete_all_records` function and apply the changes described in the hosted db to your cloud account:

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
