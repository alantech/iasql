---
id: "aws_iam_entity_access_key.AccessKey"
title: "access_key"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage access keys for IAM users. Access keys are long-term credentials for an IAM user or the AWS account root user.
You can use access keys to sign programmatic requests to the AWS CLI or AWS API (directly or using the AWS SDK).

Access keys consist of two parts: an access key ID (for example, AKIAIOSFODNN7EXAMPLE) and a secret access key (for example, wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY).
Like a user name and password, you must use both the access key ID and secret access key together to authenticate your requests.

Access keys can only be listed and deleted. The access keys can be created using the `access_key_request` method.

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html

## Columns

• **access\_key\_id**: `string`

AWS generated ID for the access key

• **create\_date**: `date`

Creation date

• `Optional` **status**: [`access_key_status`](../enums/aws_iam_entity_access_key.accessKeyStatusEnum.md)

Status of the Access Key

• **user**: [`iam_user`](aws_iam_entity_user.IamUser.md)

Reference to the user for this record
