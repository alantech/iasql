---
sidebar_position: 3
slug: '/quickstart'
---

# Quickstart

In this tutorial we will use IaSQL to deploy a Node.js HTTP server within a docker container on your AWS account using ECS, ECR and ELB. The container image will be hosted as a public repository in ECR and deployed to ECS using Fargate.

:::tip

All the code from this tutorial can be found in this [template repository](https://github.com/iasql/quickstart) which you can use to [create a new Github repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) for your IaSQL project.

:::

## Setup programmatic access for your AWS account

1. Follow the steps in this [guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-prereqs.html#getting-started-prereqs-iam) to sign up to AWS, create an IAM user account and create credentials for it.

2. Now we will create a credentials file for the IAM role you just created. The file must be named `credentials` and is located underneath `.aws/` directory in your home directory.

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="Option 1: Use the CLI" label="Option 1: Use the CLI" default>

  To create this file using the CLI, [install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html). If you’re using Homebrew on macOS, you can use [awscli](https://formulae.brew.sh/formula/awscli) via `brew install awscli`.

  After installing the CLI, configure it with your IAM credentials using the `aws configure` command:

  ```bash
  $ aws configure
  AWS Access Key ID [None]: <YOUR_ACCESS_KEY_ID>
  AWS Secret Access Key [None]: <YOUR_SECRET_ACCESS_KEY>
  Default region name [None]:
  Default output format [None]:
  ```
  Now you’ve created the `~/.aws/credentials` file and populated it with the expected settings.

  </TabItem>
  <TabItem value="Option 2: Create manually" label="Option 2: Create manually">

  You can also create the shared credentials file manually in the correct location:

  ```bash
  [default]
  aws_access_key_id = <YOUR_ACCESS_KEY_ID>
  aws_secret_access_key = <YOUR_SECRET_ACCESS_KEY>
  ```

  </TabItem>
</Tabs>

## Start managing your AWS account with an IaSQL db

1. [Install](/install) the IaSQL service CLI

2. Provision a new PG db to manage your AWS account by running `iasql new`. The CLI will prompt you to enter a name for the db, pick an AWS region and pick an AWS profile if you have more than one.

```bash
$ iasql new

✔ IaSQL db name · startup
✔ Pick AWS region · us-east-2
✔ Default AWS CLI credentials found. Do you wish to use those? · yes
✔ Pick AWS Profile · default
✔ Done
┌─────────────────┬───────────────────┬──────────┬──────────────────┐
│ Database Server │ Database Name     │ Username │ Password         │
├─────────────────┼───────────────────┼──────────┼──────────────────┤
│ db.iasql.com    │ _4b2bb09a59a411e4 │ d0va6ywg │ nfdDh#EP4CyzveFr │
└─────────────────┴───────────────────┴──────────┴──────────────────┘
✔ As a PG connection string · postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4
! This is the only time we will show you these credentials, be sure to save them.
```

## Add the necessary cloud services to your database

Run `iasql install` and select the following modules on your prod db: `aws_cloudwatch`, `aws_ecr`, `aws_ecs`, `aws_elb` and `aws_security_group`.

```bash
$ iasql install

✔ Pick IaSQL db · prod
? Use arrows to move, space to (de)select modules and enter to submit ›
  [✔] aws_cloudwatch
  [ ] aws_ec2
  [✔] aws_ecr
  [✔] aws_ecs
  [✔] aws_elb
  [ ] aws_rds
❯ [✔] aws_security_group
✔ Confirm installation · yes
✔ Done
```

## Connect to your db and provision cloud resources

1. Install `psql` in your command line by following the instructions for your corresponding OS [here](https://www.postgresql.org/download/)

2. Get a local copy of the [SQL script](https://github.com/iasql/quickstart/blob/main/quickstart.sql) hosted in the repository for this quickstart

```bash
git clone git@github.com:iasql/quickstart.git
cd quickstart
```

3. Run the script on your db by invoking `psql` with the connection string provided on db creation and set the desired `project-name` parameter that your resources will be named after:

```bash
psql postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4 -v project_name="'quickstart'" -f quickstart.sql
```

:::note

The `project-name` can only contain alphanumeric characters and hyphens(-) because it will be used to name the load balancer

:::

4. Apply the changes described in the db to your cloud account

```bash
$ iasql apply prod
✔ Press enter to confirm apply · yes
TaskDefinition has 1 record to create
┌────┬──────────────────┬──────────────────┬──────────────────┬──────────┬─────────────┬──────────────────┬─────────────┬────────┬─────────────────┬───────────┐
│ id │ taskDefinitionA+ │ containers       │ family           │ revision │ taskRoleArn │ executionRoleArn │ networkMode │ status │ reqCompatibili+ │ cpuMemory │
├────┼──────────────────┼──────────────────┼──────────────────┼──────────┼─────────────┼──────────────────┼─────────────┼────────┼─────────────────┼───────────┤
│ 1  │                  │ quickstart+      │ quickstart+      │ 1        │             │                  │ awsvpc      │ ACTIVE │ FARGATE         │ 2vCPU-8GB │
└────┴──────────────────┴──────────────────┴──────────────────┴──────────┴─────────────┴──────────────────┴─────────────┴────────┴─────────────────┴───────────┘
AwsPublicRepository has 1 record to create
┌────┬────────────────────────────┬───────────────┬────────────┬───────────────┬───────────┐
│ id │ repositoryName             │ repositoryArn │ registryId │ repositoryUri │ createdAt │
├────┼────────────────────────────┼───────────────┼────────────┼───────────────┼───────────┤
│ 1  │ quickstart-repository      │               │            │               │           │
└────┴────────────────────────────┴───────────────┴────────────┴───────────────┴───────────┘
AwsSecurityGroupRule has 2 records to create
┌────┬─────────────────────┬────────────────────────────────┬──────────┬────────────┬──────────┬────────┬───────────┬──────────┬──────────────┬─────────────┐
│ id │ securityGroupRuleId │ securityGroup                  │ isEgress │ ipProtocol │ fromPort │ toPort │ cidrIpv4  │ cidrIpv6 │ prefixListId │ description │
├────┼─────────────────────┼────────────────────────────────┼──────────┼────────────┼──────────┼────────┼───────────┼──────────┼──────────────┼─────────────┤
│ 1  │                     │ quickstart-security-group      │ false    │ tcp        │ 8088     │ 8088   │ 0.0.0.0/0 │          │              │             │
│ 2  │                     │ quickstart-security-group      │ true     │ -1         │ -1       │ -1     │ 0.0.0.0/0 │          │              │             │
└────┴─────────────────────┴────────────────────────────────┴──────────┴────────────┴──────────┴────────┴───────────┴──────────┴──────────────┴─────────────┘
AwsSecurityGroup has 1 record to create
┌────┬────────────────────────────────┬────────────────────────────────┬─────────┬─────────┬──────────────┬────────────────────┐
│ id │ description                    │ groupName                      │ ownerId │ groupId │ vpcId        │ securityGroupRules │
├────┼────────────────────────────────┼────────────────────────────────┼─────────┼─────────┼──────────────┼────────────────────┤
│ 2  │ quickstart-security-group      │ quickstart-security-group      │         │         │ vpc-26f5734d │ ,                  │
└────┴────────────────────────────────┴────────────────────────────────┴─────────┴─────────┴──────────────┴────────────────────┘
AwsTargetGroup has 1 record to create
┌────┬───────────┬───────────┬───────────┬──────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ targetGr+ │ targetGr+ │ ipAddres+ │ protocol │ port │ vpc       │ healthC+ │ healthC+ │ healthC+ │ healthC+ │ healthC+ │ unhealt+ │ healthC+ │ protoco+ │
├────┼───────────┼───────────┼───────────┼──────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 1  │ quicksta+ │           │ ipv4      │ HTTP     │ 8088 │ vpc-26f5+ │ HTTP     │          │          │          │          │          │ /health  │ HTTP1    │
└────┴───────────┴───────────┴───────────┴──────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
AwsListener has 1 record to create
┌────┬─────────────┬───────────────────────────────┬──────┬──────────┬────────────────┐
│ id │ listenerArn │ loadBalancer                  │ port │ protocol │ defaultActions │
├────┼─────────────┼───────────────────────────────┼──────┼──────────┼────────────────┤
│ 1  │             │ quickstart-load-balancer      │ 8088 │ HTTP     │ forward        │
└────┴─────────────┴───────────────────────────────┴──────┴──────────┴────────────────┘
Cluster has 1 record to create
┌────┬─────────────────────────┬────────────┬───────────────┐
│ id │ clusterName             │ clusterArn │ clusterStatus │
├────┼─────────────────────────┼────────────┼───────────────┤
│ 3  │ quickstart-cluster      │            │               │
└────┴─────────────────────────┴────────────┴───────────────┘
Service has 1 record to create
┌────┬─────────────────────────┬─────┬────────┬─────────────────────────┬──────┬──────────────┬────────────┬────────────────────┬─────────┬───────────────┐
│ id │ name                    │ arn │ status │ cluster                 │ task │ desiredCount │ launchType │ schedulingStrategy │ network │ loadBalancers │
├────┼─────────────────────────┼─────┼────────┼─────────────────────────┼──────┼──────────────┼────────────┼────────────────────┼─────────┼───────────────┤
│ 1  │ quickstart-service      │     │        │ quickstart-cluster │      │ 1            │ FARGATE    │ REPLICA            │ ENABLED │               │
└────┴─────────────────────────┴─────┴────────┴─────────────────────────┴──────┴──────────────┴────────────┴────────────────────┴─────────┴───────────────┘
AwsLoadBalancer has 1 record to create
┌────┬───────────┬───────────┬─────────┬───────────┬──────────┬──────────┬────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ loadBala+ │ loadBala+ │ dnsName │ canonica+ │ created+ │ scheme   │ state  │ loadBal+ │ vpc      │ subnets  │ availab+ │ securit+ │ ipAddre+ │ custome+ │
├────┼───────────┼───────────┼─────────┼───────────┼──────────┼──────────┼────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 1  │ quicksta+ │           │         │           │          │ interne+ │ active │ applica+ │ vpc-26f+ │ arn:aws+ │ us-east+ │ quickst+ │ ipv4     │          │
└────┴───────────┴───────────┴─────────┴───────────┴──────────┴──────────┴────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

## Login, build and push your code to the container registry

1. Grab your new `ECR URI` from your DB
```sql
psql postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4
_4b2bb09a59a411e4=> SELECT repository_uri
FROM aws_public_repository
WHERE repository_name = '<project-name>-repository';
```

2. Login to AWS ECR using the AWS CLI. Run the following command and using the correct `<ECR-URI>` and AWS `<profile>`

```bash
aws ecr get-login-password --region us-east-1 --profile <profile> | docker login --username AWS --password-stdin <ECR-URI>
```

3. Build your image locally

```bash
docker build -t <project-name>-repository hello-iasql/Dockerfile
```

4. Tag your image

```bash
docker tag <project-name>-repository:latest <ECR-URI>:latest
```

5. Push your image

```bash
docker push <ECR URI>:latest
```

6. Grab your load balancer DNS and access your service!
```sql
psql postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4
_4b2bb09a59a411e4=> SELECT dns_name
FROM aws_load_balancer
WHERE load_balancer_name = '<project-name>-load-balancer'
```

7. Connect to your service!

```
curl <DNS-NAME>:8088/health
```