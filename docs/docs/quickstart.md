---
sidebar_position: 3
slug: '/quickstart'
---

# Quickstart

In this tutorial we will deploy an HTTP server and database via IaSQL to your AWS account using the following cloud services: ECS, ECR, RDS and ELB.

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

## Start managing your AWS account with IaSQL

1. [Install](/install) the IaSQL service CLI

2. Let's provision a new PG db to manage your AWS account with `iasql new` which will prompt you to enter a name for the db, pick an AWS region and pick an AWS profile if you have more than one.

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
│ db.iasql.com    │ _ec99f4322819c561 │ cbdy43d0 │ PI?$6nbzOfas!mRC │
└─────────────────┴───────────────────┴──────────┴──────────────────┘
! This is the only time we will show you these credentials, be sure to save them.
```

## Add cloud services to manage with `prod` database

```bash
$ iasql install

✔ Pick IaSQL db · prod
? Use arrows to move, space to (de)select modules and enter to submit ›
  [✔] aws_cloudwatch
  [ ] aws_ec2
  [✔] aws_ecr
  [✔] aws_ecs
  [✔] aws_elb
  [✔] aws_rds
❯ [✔] aws_security_group
✔ Confirm installation · yes
✔ Done
```

## Connect to IaSQL PG