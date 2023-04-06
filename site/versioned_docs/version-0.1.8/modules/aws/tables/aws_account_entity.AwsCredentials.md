---
id: "aws_account_entity.AwsCredentials"
title: "aws_credentials"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table that will hold the user's AWS credentials.
When you interact with AWS, you specify your AWS security credentials to verify who you
are and whether you have permission to access the resources that you are requesting.
AWS uses the security credentials to authenticate and authorize your requests.

When a new connection to IaSQL is issued, the AWS credentials are stored.
The keys can be generated from the AWS console for each registered user

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html

## Columns

• **access\_key\_id**: `string`

AWS Access Key

• **secret\_access\_key**: `string`

AWS Secret Access Key

• **session\_token**: `string`

AWS Session Token
For temporary security credentials only
