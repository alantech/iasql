---
id: "aws_iam_entity_user.IamUser"
title: "Table: iam_user"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS IAM users. An AWS Identity and Access Management (IAM) user is an entity that you create in AWS to represent the person
or application that uses it to interact with AWS. A user in AWS consists of a name and credentials.

**`Example`**

```sql TheButton[Manage an IAM user]="Manage an IAM user"
INSERT INTO iam_user (user_name, path, attached_policies_arns) VALUES ('user_name', '/username/',
array['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy']);

SELECT * FROM iam_user WHERE user_name = 'user_name';

DELETE FROM iam_user WHERE user_name = 'user_name';
```

**`See`**

 - https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-iam-integration.ts#L816
 - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html

## Columns

• `Optional` **access\_keys**: [`access_key`](aws_iam_entity_access_key.AccessKey.md)[]

Access Keys associated to an specific user

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html

• `Optional` **arn**: `string`

AWS ARN to identify the user

• `Optional` **attached\_policies\_arns**: `string`[]

ARN for the policies that are attached to this specific role

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_job-functions_create-policies.html

• **create\_date**: `date`

Creation date

• `Optional` **path**: `string`

The path to the user
must start and end with /
only can contain alphanumeric characters

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html

• `Optional` **user\_id**: `string`

AWS generated ID for the user

• **user\_name**: `string`

Name for the user
Guaranteed unique in AWS
Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.
