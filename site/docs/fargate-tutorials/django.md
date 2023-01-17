---
sidebar_position: 3
slug: '/django'
---

# Deploy containerized app to ECS Fargate using IaSQL on Django (Python)

In this tutorial, we will run [Django SQL migrations](https://docs.djangoproject.com/en/4.0/topics/migrations/) on top of IaSQL to deploy an HTTP server within a docker container on your AWS account using ECS, ECR and ELB. The container image will be hosted as a public repository in ECR and deployed to ECS using Fargate.

The code for this tutorial lives in this part of the [repository](https://github.com/iasql/iasql-engine/tree/main/examples/ecs-fargate/django/app/infra/migrations/0003_initial.py).

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

2. The first migration calls the `iasql_install` SQL function to install the ECS simplified [module](../concepts/module.md) into the hosted database.

```sql title="psql postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4 -c"
SELECT
  *
FROM
  iasql_install ('aws_ecs_simplified', 'aws_codebuild');
```

If the function call is successful, it will return a virtual table with a record for each new table in your database under `created_table_name` and the number of existing resources or records imported from the account under `record_count`.

```sql
       module_name        |      created_table_name       | record_count
--------------------------+-------------------------------+--------------
 aws_cloudwatch           | log_group                     |            0
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
```

## Connect to the hosted db and provision cloud resources in your AWS account

1. Get a local copy of the [ECS Fargate examples](https://github.com/iasql/iasql-engine/tree/main/examples/ecs-fargate)

2. (Optional) Create and activate a virtual environment to install python dependencies

   ```bash
   python -m venv <env-name>
   source <env-name>/bin/activate
   ```

3. Install the project dependencies under the `django/app` folder

   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file with the connection parameters provided on db creation. In this case:

   ```title="django/app/.env"
   AWS_REGION=eu-west-2
   DB_NAME=_3ba201e349a11daf
   DB_USER=qpp3pzqb
   DB_PASSWORD=LN6jnHfhRJTBD6ia
   ```

5. (Optional) Set the desired project name that your resources will be named after by changing the `IASQL_PROJECT_NAME` in the `my_project/app/app/settings.py`. If the name is not changed, `quickstart` will be used.

   :::note

   The `project-name` can only contain alphanumeric characters and hyphens(-) because it will be used to name the load balancer

   :::

6. Per the [Django database documentation](https://docs.djangoproject.com/en/4.0/ref/databases/#postgresql-connection-settings-1), to connect to a new database you have to update the `DATABASES` in the `my_project/app/app/settings.py` file. This is already configure in the example project.

   ```python title="django/app/app/settings.py"
   DATABASES = {
       ...
       'infra': {
           'ENGINE': 'django.db.backends.postgresql',
           'NAME': env('DB_NAME'),
           'USER': env('DB_USER'),
           'PASSWORD': env('DB_PASSWORD'),
           'HOST': 'db.iasql.com',
           'PORT': '5432',
       }
   }
   ```

### If you are using the template example go to step 9. The following steps explains how to instrospect an existing DB in Django.

7. The second migration correspond to the Django models instrospected from the modules that have been installed in the database. To introspect the schema from your database run the following command. More information [here](https://docs.djangoproject.com/en/4.0/howto/legacy-databases/).

```bash
python manage.py inspectdb --database=infra > infra/models.py
```

:::note

After running the `inspectdb` command you will need to tweak the models Django generated until they work the way you’d like.
In our case you will have to modify the `my_project/app/infra/models.py` file as follow:

1. Replace `CharField` with `TextField`
2. Remove all `max_length=-1`. Helpful regex for a replacement: `[\s,]*max_length=-1[,\s]*`
3. Add the following import `from django.contrib.postgres.fields import ArrayField`
4. Replace in the `Service` class the `subnets` property with `subnets = ArrayField(models.TextField())`
5. Replace in the `Role` class the `attached_policies_arns` property with `attached_policies_arns = ArrayField(models.TextField())`
6. Add `related_name` argument to the definition for `IasqlDependencies.dependency`. (`dependency = models.ForeignKey('IasqlModule', models.DO_NOTHING, db_column='dependency', related_name='module')`)
7. Add `related_name` argument to the definition for `TaskDefinition.execution_role_name`. (`execution_role_name = models.ForeignKey(Role, models.DO_NOTHING, db_column='execution_role_name', blank=True, null=True, related_name='execution_role_name')`)
8. Add `related_name` argument to the definition for `TaskDefinition.task_role_name`. (`task_role_name = models.ForeignKey(Role, models.DO_NOTHING, db_column='task_role_name', blank=True, null=True, related_name='task_role_name')`)

:::

9. After instrospecting the db you will need to generate the migration so you can have the `my_project/app/infra/migrations/0002_inspectdb.py` file.

   ```bash
   python manage.py makemigrations --name inspectdb infra
   ```

   :::caution

   If you install or uninstall IaSQL [modules](../concepts/module.md) the database schema will change and you will need to run steps 7 and 8 to
   introspect the correct schema once again.

   :::

10. Now you can use IaSQL models to create your resources. Run the existing migrations with:

    ```bash
    python manage.py migrate --database infra infra
    ```

    The operations of the `my_project/app/infra/migrations/0003_initial.py` migration will apply the changes described in the hosted db to your cloud account which will take a few minutes waiting for AWS

    ```python title="my_project/app/infra/migrations/0003_initial.py"
    ...
    operations = [
        migrations.RunPython(code=quickstart_up, reverse_code=apply),
        migrations.RunPython(code=apply, reverse_code=quickstart_down),
    ]
    ```

If the function call is successful, it will return a list of dicts with each cloud resource that has been created, deleted or updated.

```python
[{'action': 'create', 'table_name': 'log_group', 'id': None, 'description': 'quickstart-log-group'}, {'action': 'create', 'table_name': 'repository', 'id': None, 'description': 'quickstart-repository'}, {'action': 'create', 'table_name': 'iam_role', 'id': None, 'description': 'quickstart-ecs-task-exec-role'}, {'action': 'create', 'table_name': 'security_group', 'id': 31, 'description': '31'}, {'action': 'create', 'table_name': 'security_group_rule', 'id': 48, 'description': '48'}, {'action': 'create', 'table_name': 'security_group_rule', 'id': 49, 'description': '49'}, {'action': 'create', 'table_name': 'listener', 'id': 16, 'description': '16'}, {'action': 'create', 'table_name': 'load_balancer', 'id': None, 'description': 'quickstart-load-balancer'}, {'action': 'create', 'table_name': 'target_group', 'id': None, 'description': 'quickstart-target'}, {'action': 'create', 'table_name': 'cluster', 'id': None, 'description': 'quickstart-cluster'}, {'action': 'create', 'table_name': 'task_definition', 'id': 16, 'description': '16'}, {'action': 'create', 'table_name': 'service', 'id': None, 'description': 'quickstart-service'}, {'action': 'delete', 'table_name': 'security_group_rule', 'id': None, 'description': 'sgr-024274a604968919e'}]
```

## Login, build and push your code to the container registry

Previously, you needed to manually build and push your image to the ECR. But recently we've added the high-level `ecr_build` SQL function which does all those steps automatically. It will do the following:

- Pull the code from your Github repository
- Build the Docker image in the directory you've specified
- Push the image to the ECR repository you've provided

All of these steps will be done in a CodeBuild project in your AWS account. To use the `ecr_build` function, you can run:

```sql
SELECT
  ecr_build (
    'https://github.com/iasql/iasql-engine/', -- replace with your own Github repo if you want to use your own codebase
    (
      SELECT
        id
      FROM
        repository
      WHERE
        repository_name = 'quickstart-repository'
    )::VARCHAR(255), -- replace quickstart if you've changed the project name
    './examples/ecs-fargate/django/app', -- the sub directory in the Github repo that the image should be built in
    'main', -- the Github repo branch name
    '' -- replace your github personal access token here if the repo is private
  );
```

After running the above SQL command to completion, you can check the running app using the load balancer DNS name. To grab the name, run:

```bash
QUICKSTART_LB_DNS=$(psql -At 'postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4' -c "
SELECT dns_name
FROM load_balancer
WHERE load_balancer_name = '<project-name>-load-balancer';")
```

And then connect to your service!

```
curl ${QUICKSTART_LB_DNS}:8088/health
```

## Delete Managed Cloud Resources

Delete the resources created by this tutorial using the following SQL code:

```sql title="psql postgres://qpp3pzqb:LN6jnHfhRJTBD6ia@db.iasql.com/_3ba201e349a11daf -c"
SELECT iasql_begin();
DELETE FROM
  repository_image
WHERE
  private_repository_id = (
    SELECT
      id
    FROM
      repository
    WHERE
      repository_name = 'quickstart-repository'
  );

DELETE FROM
  ecs_simplified
WHERE
  app_name = 'quickstart';
SELECT iasql_commit();
```

The `iasql_begin()` and `iasql_commit()` functions are IaSQL RPCs that are used to start and then end a transaction. We use those two functions to push changes to the cloud.

If the function call is successful, it will return a virtual table with a record for each cloud resource that has been created, deleted or updated.

```text
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
```
