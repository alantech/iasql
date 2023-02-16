---
id: "aws_iam_entity_user.IamUser"
title: "iam_user"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS IAM users. An AWS Identity and Access Management (IAM) user is an entity that you create in AWS to represent the person
or application that uses it to interact with AWS. A user in AWS consists of a name and credentials.

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html

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
