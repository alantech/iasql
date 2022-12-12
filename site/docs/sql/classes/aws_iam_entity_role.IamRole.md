---
id: "aws_iam_entity_role.IamRole"
title: "Table: iam_role"
sidebar_label: "iam_role"
custom_edit_url: null
---

Table to manage AWS IAM roles.

**`Example`**

```sql
INSERT INTO iam_role (role_name, assume_role_policy_document) VALUES ('lambda_role_name', '{
Version: '2012-10-17',
Statement: [
  {
    Effect: 'Allow',
    Principal: {
      Service: 'lambda.amazonaws.com',
    },
    Action: 'sts:AssumeRole',
  },
],
}');
SELECT * FROM iam_role WHERE role_name = 'lambda_role_name';
DELETE FROM iam_role WHERE role_name = 'lambda_role_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-iam-integration.ts#L183
 - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html
TODO complete schema

## Columns

• `Optional` **arn**: `string`

AWS ARN to identify the role

___

• **assume\_role\_policy\_document**: `Object`

JSON blob to define the policy for the role
Returns a set of temporary security credentials that you can use to access AWS resources that you might not normally have access to.

**`See`**

https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html

#### Index signature

▪ [key: `string`]: `any`

___

• `Optional` **attached\_policies\_arns**: `string`[]

ARN for the policies that are attached to this specific role

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_job-functions_create-policies.html

___

• `Optional` **description**: `string`

Description for the role

___

• **role\_name**: `string`

Name for the role
Guaranteed unique in AWS
Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.
