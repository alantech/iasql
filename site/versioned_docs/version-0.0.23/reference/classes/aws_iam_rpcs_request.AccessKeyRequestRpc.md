---
id: "aws_iam_rpcs_request.AccessKeyRequestRpc"
title: "Method: access_key_request"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method for requesting a new Access Key for an IAM user

Returns following columns:

- status: OK if the key was created successfully
- message: Error message in case of failure
- accessKeyId: The ID for the access key
- secretAccessKey: The secret key used to sign requests. You will need to store it safely, as it won't be stored and shown again.

**`Example`**

```sql TheButton[Request an IAM User Access Key]="Request an IAM User Access Key"
SELECT * FROM access_key_request('user');
```

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
