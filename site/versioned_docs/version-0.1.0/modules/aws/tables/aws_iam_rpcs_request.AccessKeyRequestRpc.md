---
id: "aws_iam_rpcs_request.AccessKeyRequestRpc"
title: "access_key_request"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for requesting a new Access Key for an IAM user

Returns following columns:

- status: OK if the key was created successfully
- message: Error message in case of failure
- accessKeyId: The ID for the access key
- secretAccessKey: The secret key used to sign requests. You will need to store it safely, as it won't be stored and shown again.

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
