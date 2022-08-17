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

An AWS IAM role controls the access to the cloud resources that it is associated with via a JSON policy document that is stored in the [`role`](https://dbdocs.io/iasql/iasql?table=role&schema=public&view=table_structure) table. Below we create a role with a policy and apply the change.

```sql
INSERT INTO role (role_name, assume_role_policy_document)
VALUES ('ecs-assume-role', '{"Version": "2012-10-17", "Statement": [{"Sid": "", "Effect": "Allow", "Principal": {"Service": "ecs-tasks.amazonaws.com"},"Action": "sts:AssumeRole"}]}');

SELECT * FROM iasql_apply();
```
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/INSERT%20INTO%20role%20%28role_name%2C%20assume_role_policy_document%29%0AVALUES%20%28%27ecs-assume-role%27%2C%20%27%7B%22Version%22%3A%20%222012-10-17%22%2C%20%22Statement%22%3A%20%5B%7B%22Sid%22%3A%20%22%22%2C%20%22Effect%22%3A%20%22Allow%22%2C%20%22Principal%22%3A%20%7B%22Service%22%3A%20%22ecs-tasks.amazonaws.com%22%7D%2C%22Action%22%3A%20%22sts%3AAssumeRole%22%7D%5D%7D%27%29%3B%0A%0ASELECT%20%2A%20FROM%20iasql_apply%28%29%3B', '_blank')}
>
Run SQL
</button>