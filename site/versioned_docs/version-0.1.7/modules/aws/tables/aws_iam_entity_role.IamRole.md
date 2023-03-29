---
id: "aws_iam_entity_role.IamRole"
title: "iam_role"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS IAM roles. An IAM role is an IAM identity that you can create in your account that has specific permissions.

An IAM role is similar to an IAM user, in that it is an AWS identity with permission policies that determine what the identity can and cannot do in AWS.
However, instead of being uniquely associated with one person, a role is intended to be assumable by anyone who needs it.

Also, a role does not have standard long-term credentials such as a password or access keys associated with it.
Instead, when you assume a role, it provides you with temporary security credentials for your role session.

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html

## Columns

• `Optional` **arn**: `string`

AWS ARN to identify the role

• **assume\_role\_policy\_document**: `policy`

JSON blob to define the policy for the role
Returns a set of temporary security credentials that you can use to access AWS resources that you might not normally have access to.

**`See`**

https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html

• `Optional` **attached\_policies\_arns**: `string`[]

ARN for the policies that are attached to this specific role

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_job-functions_create-policies.html

• `Optional` **description**: `string`

Description for the role

• **role\_name**: `string`

Name for the role
Guaranteed unique in AWS
Maximum 128 characters. Use alphanumeric and '+=,.@-_' characters.
