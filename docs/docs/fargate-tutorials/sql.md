---
sidebar_position: 1
slug: '/fargate'
---

# Deploy containerized app to AWS ECS Fargate using IaSQL

In this tutorial, we will run SQL queries on an IaSQL [database](../concepts/db.md) to deploy a Node.js HTTP server within a docker container on your AWS account using Fargate ECS, CodeBuild, IAM, ECR, and ELB. The container image will be built in CodeBuild, hosted within a private repository in ECR, and deployed to ECS using Fargate.

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

If you want to [connect](../how-to/connect.md) to the PostgreSQL database outside of the IaSQL [dashboard](https://app.iasql.com) SQL editor, make sure to copy the PostgreSQL connection string as you will not see it again.

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
 aws_iam                  | iam_role                      |            0
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

## Provision cloud resources in your AWS account, and deploy your app

The two `SELECT * from iasql_apply();` queries will [`apply`](../concepts/apply-and-sync.md) the changes described in the hosted db to your cloud account which can take a few minutes waiting for AWS. It will then print a virtual table with the cloud resources that have been created, deleted, or updated.

```sql
INSERT INTO ecs_simplified (app_name, app_port, public_ip, image_tag)
VALUES ('quickstart', 8088, true, 'latest');

SELECT * from iasql_apply();

INSERT INTO source_credentials_import (token, source_type, auth_type)
VALUES ('gh_XXXXXXXXX', 'GITHUB', 'PERSONAL_ACCESS_TOKEN');

INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
VALUES ('quickstart', '{
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
}', array['arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess', 'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess', 'arn:aws:iam::aws:policy/EC2InstanceProfileForImageBuilderECRContainerBuilds']);

INSERT INTO codebuild_project (project_name, source_type, service_role_name, source_location, build_spec)
VALUES ('quickstart', 'GITHUB', 'quickstart', 'https://github.com/iasql/iasql-engine', SELECT generate_put_ecr_image_build_spec('us-west-1', 'latest', 'quickstart-repository', SELECT repository_uri FROM ecs_simplified WHERE app_name = 'quickstart', 'examples/ecs-fargate/prisma/app'));

INSERT INTO codebuild_build_import (project_name)
VALUES ('quickstart');

SELECT * from iasql_apply();
```

<!--- https://www.urlencoder.org/ -->
<a href='https://app.iasql.com/#/button/INSERT%20INTO%20ecs_simplified%20%28app_name%2C%20app_port%2C%20public_ip%2C%20image_tag%29%0AVALUES%20%28%27quickstart%27%2C%208088%2C%20true%2C%20%27latest%27%29%3B%0A%0ASELECT%20%2A%20from%20iasql_apply%28%29%3B%0A%0AINSERT%20INTO%20source_credentials_import%20%28token%2C%20source_type%2C%20auth_type%29%0AVALUES%20%28%27gh_XXXXXXXXX%27%2C%20%27GITHUB%27%2C%20%27PERSONAL_ACCESS_TOKEN%27%29%3B%0A%0AINSERT%20INTO%20role%20%28role_name%2C%20assume_role_policy_document%2C%20attached_policies_arns%29%0AVALUES%20%28%27quickstart%27%2C%20%27%7B%0A%20%20%22Statement%22%3A%20%5B%0A%20%20%20%20%7B%0A%20%20%20%20%20%20%22Effect%22%3A%20%22Allow%22%2C%0A%20%20%20%20%20%20%22Principal%22%3A%20%7B%0A%20%20%20%20%20%20%20%20%22Service%22%3A%20%22codebuild.amazonaws.com%22%0A%20%20%20%20%20%20%7D%2C%0A%20%20%20%20%20%20%22Action%22%3A%20%22sts%3AAssumeRole%22%0A%20%20%20%20%7D%2C%0A%20%20%5D%2C%0A%20%20%22Version%22%3A%20%222012-10-17%22%0A%7D%27%2C%20array%5B%27arn%3Aaws%3Aiam%3A%3Aaws%3Apolicy%2FAWSCodeBuildAdminAccess%27%2C%20%27arn%3Aaws%3Aiam%3A%3Aaws%3Apolicy%2FCloudWatchLogsFullAccess%27%2C%20%27arn%3Aaws%3Aiam%3A%3Aaws%3Apolicy%2FEC2InstanceProfileForImageBuilderECRContainerBuilds%27%5D%29%3B%0A%0AINSERT%20INTO%20codebuild_project%20%28project_name%2C%20source_type%2C%20service_role_name%2C%20source_location%2C%20build_spec%29%0AVALUES%20%28%27quickstart%27%2C%20%27GITHUB%27%2C%20%27quickstart%27%2C%20%27https%3A%2F%2Fgithub.com%2Fiasql%2Fiasql-engine%27%2C%20SELECT%20generate_put_ecr_image_build_spec%28%27us-west-1%27%2C%20%27latest%27%2C%20%27quickstart-repository%27%2C%20SELECT%20repository_uri%20FROM%20ecs_simplified%20WHERE%20app_name%20%3D%20%27quickstart%27%2C%20%27examples%2Fecs-fargate%2Fprisma%2Fapp%27%29%29%3B%0A%0AINSERT%20INTO%20codebuild_build_import%20%28project_name%29%0AVALUES%20%28%27quickstart%27%29%3B%0A%0ASELECT%20%2A%20from%20iasql_apply%28%29%3B'>
<button className={"button button--primary button--lg margin-bottom--lg"}>
Run SQL
</button>
</a>

If the function calls are successful, they will return a virtual table with a record for each cloud resource type that has been created, deleted, or updated.

Grab your load balancer DNS and access your service!

```sql
SELECT load_balancer_dns
FROM ecs_simplified
WHERE app_name = 'quickstart';
```

<!--- https://www.urlencoder.org/ -->
<a href='https://app.iasql.com/#/button/SELECT%20load_balancer_dns%0AFROM%20ecs_simplified%0AWHERE%20app_name%20%3D%20%27quickstart%27%3B'>
<button
  className={"button button--primary button--lg margin-bottom--lg"}
>
Run SQL
</button>
</a>

```bash
curl ${QUICKSTART_LB_DNS}:8088/health
```

## Delete managed cloud resources

:::warning

If you did not create a new account this section will delete **all** records managed by IaSQL, including the ones that previously existed in the account under any of the used modules. Run `SELECT * FROM iasql_plan_apply()` after `SELECT delete_all_records();` and before `SELECT iasql_apply();` to get a preview of what would get deleted. To undo `SELECT delete_all_records();`, simply run `SELECT iasql_sync();` which will synchronize the database with the cloud's state.

:::

Delete all IaSQL records invoking the void `delete_all_records` function and apply the changes described in the hosted db to your cloud account

```sql
SELECT delete_all_records();
SELECT * from iasql_apply();
```

<!--- https://www.urlencoder.org/ -->
<a href='https://app.iasql.com/#/button/SELECT%20delete_all_records%28%29%3B%0ASELECT%20%2A%20from%20iasql_apply%28%29%3B'>
<button
  className={"button button--primary button--lg margin-bottom--lg"}
>
Run SQL
</button>
</a>

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
 delete | iam_role            | [NULL] | ecsTaskExecRole

```
