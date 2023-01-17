---
sidebar_position: 3
slug: '/aws_iam'
---

# AWS IAM

## Create an IAM role

Install the AWS IAM module

```sql
SELECT * FROM iasql_install('aws_iam');
```

An AWS IAM role controls the access to the cloud resources that it is associated with via a JSON policy document that is stored in the [`iam_role`](https://dbdocs.io/iasql/iasql?table=iam_role&schema=public&view=table_structure) table. Below we create a role with a policy and apply the change.

```sql TheButton
SELECT iasql_begin();
INSERT INTO iam_role (role_name, assume_role_policy_document)
VALUES ('ecs-assume-role', '{"Version": "2012-10-17", "Statement": [{"Sid": "", "Effect": "Allow", "Principal": {"Service": "ecs-tasks.amazonaws.com"},"Action": "sts:AssumeRole"}]}');

SELECT iasql_commit();
```
