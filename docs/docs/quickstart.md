---
sidebar_position: 3
---

# Quickstart

In this tutorial we will use IaSQL to deploy a Node.js HTTP server within a docker container on your AWS account using ECS, ECR and ELB. The container image will be hosted as a public repository in ECR and deployed to ECS using Fargate.

:::tip

All the code from this tutorial can be found in this [template repository](https://github.com/iasql/quickstart) which you can use to [create a new Github repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) for your IaSQL project.

:::

## Setup your AWS account with programmatic access

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

Run `iasql install` to add the following modules on your prod db: `aws_cloudwatch`, `aws_ecr`, `aws_ecs`, `aws_elb` and `aws_security_group`.

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

2. Take the [SQL script from the repository for this quickstart](https://github.com/iasql/quickstart/blob/main/quickstart.sql) and run it on your db by invoking `psql` with the connection string provided on db creation:

```sql
psql postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4 -f <path>/<to>/quickstart.sql
```

4. Apply the changes described in the db to your cloud account

```sh
iasql apply
```
<!--TODO Fill out with table -->

## Login, build and push your code to the container registry

1. Grab your new `ECR URI` from your DB
```sql
psql postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4
_4b2bb09a59a411e4=> select repository_uri
from aws_ecr
where repository_name = <repository-name>
```

2. Login to AWS ECR using the AWS CLI. Run the following command and using the correct `ECR URI`

```sh
aws ecr get-login-password --region us-east-2 --profile default | docker login --username AWS --password-stdin <ECR URI>
```

3. Build your image locally

```sh
docker build -t <repository-name> <path to Dockerfile>
```

4. Tag your image

```sh
docker tag <image-name>:latest <ECR URI>:latest
```

- Push your image

```sh
docker push <ECR URI>:latest
```

6. Grab your load balancer DNS and access your service!
```sql
psql postgres://d0va6ywg:nfdDh#EP4CyzveFr@db.iasql.com/_4b2bb09a59a411e4
_4b2bb09a59a411e4=> select dns_name
from aws_load_balancer
where load_balancer_name = <load-balancer-name>
```

