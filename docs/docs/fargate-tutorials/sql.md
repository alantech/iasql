---
sidebar_position: 1
slug: '/sql'
---

# IaSQL on SQL

In this tutorial, we will run SQL queries on an IaSQL [database](../concepts/db.md) to deploy a Node.js HTTP server within a docker container on your AWS account using Fargate ECS, IAM, ECR, and ELB. The container image will be hosted as a private repository in ECR and deployed to ECS using Fargate.

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

If you want to [connect](../how-to/connect.md) to the PostgreSQL database outside of the IaSQL [dashboard])(https://app.iasql.com) SQL editor, make sure to copy the PostgreSQL connection string as you will not see it again.

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

## Provision cloud resources in your AWS account

Insert a row into the `ecs_simplified` table and [`apply`](../concepts/apply-and-sync.md) the changes described in the hosted db to your cloud account which will take a few minutes waiting for AWS


```sql
INSERT INTO ecs_simplified (app_name, app_port, public_ip, image_tag)
VALUES ('quickstart', 8088, true, 'latest');

SELECT * from iasql_apply();
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/INSERT%20INTO%20ecs_simplified%20%28app_name%2C%20app_port%2C%20public_ip%2C%20image_tag%29%0AVALUES%20%28%27quickstart%27%2C%208088%2C%20true%2C%20%27latest%27%29%3B%0A%0ASELECT%20%2A%20from%20iasql_apply%28%29%3B', '_blank')}
>
Run SQL
</button>

If the function call is successful, it will return a virtual table with a record for each cloud resource that has been created, deleted, or updated.
Login, build and push your code to the container registry

1. Grab your new `ECR URI` from the hosted DB

```sql
SELECT repository_uri
FROM ecs_simplified
WHERE app_name = 'quickstart';
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/SELECT%20repository_uri%0AFROM%20ecs_simplified%0AWHERE%20app_name%20%3D%20%27quickstart%27%3B', '_blank')}
>
Run SQL
</button>

2. Login to AWS ECR using the AWS CLI. Run the following command and use the correct `<ECR-URI>` and AWS `<profile>`

```bash
aws ecr get-login-password --region ${AWS_REGION} --profile <profile> | docker login --username AWS --password-stdin ${QUICKSTART_ECR_URI}
```

:::caution

Make sure the [CLI is configured with the same credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html), via environment variables or `~/.aws/credentials`, as the ones provided to IaSQL, or this will fail.

:::

3. Build your image locally

```bash
docker build -t quickstart-repository app
```

4. Tag your image

```bash
docker tag quickstart-repository:latest ${QUICKSTART_ECR_URI}:latest
```

5. Push your image

```bash
docker push ${QUICKSTART_ECR_URI}:latest
```

6. Grab your load balancer DNS and access your service!

```sql
SELECT load_balancer_dns
FROM ecs_simplified
WHERE app_name = 'quickstart';
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/SELECT%20load_balancer_dns%0AFROM%20ecs_simplified%0AWHERE%20app_name%20%3D%20%27quickstart%27%3B', '_blank')}
>
Run SQL
</button>

7. Connect to your service!

```bash
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
      --repository-name quickstart-repository \
      --profile <profile> \
      --image-ids imageTag=latest
```

:::caution

Make sure the [CLI is configured with the same credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html), via environment variables or `~/.aws/credentials`, as the ones provided to IaSQL, or this will fail.

:::

2. Delete all IaSQL records invoking the void `delete_all_records` function and apply the changes described in the hosted db to your cloud account

```sql
SELECT delete_all_records();
SELECT * from iasql_apply();
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/SELECT%20delete_all_records%28%29%3B%0ASELECT%20%2A%20from%20iasql_apply%28%29%3B', '_blank')}
>
Run SQL
</button>

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
