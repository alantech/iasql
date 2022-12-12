---
id: "aws_iam_entity_user.IamUser"
title: "Table: iam_user"
sidebar_label: "iam_user"
custom_edit_url: null
---

Table to manage AWS IAM users.

**`Example`**

```sql
INSERT INTO iam_user (user_name, path, attached_policies_arns) VALUES ('user_name', '/username/',
array['arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy']);
SELECT * FROM iam_user WHERE user_name = 'user_name';
DELETE FROM iam_user WHERE user_name = 'user_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-iam-integration.ts#L816
 - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html
TODO complete schema

## Columns

• `Optional` **arn**: `string`

AWS ARN to identify the user

___

• `Optional` **attached\_policies\_arns**: `string`[]

ARN for the policies that are attached to this specific role

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_job-functions_create-policies.html

___

• **create\_date**: `date`

Creation date

___

• `Optional` **path**: `string`

The path to the user
must start and end with /
only can contain alphanumeric characters

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html

___

• `Optional` **user\_id**: `string`

Internal AWS ID for the user

___

• **user\_name**: `string`

Name for the user
Guaranteed unique in AWS
Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.
