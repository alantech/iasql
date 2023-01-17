---
id: "aws_account_entity.AwsCredentials"
title: "Table: aws_credentials"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table that will hold the user's AWS credentials.
When you interact with AWS, you specify your AWS security credentials to verify who you
are and whether you have permission to access the resources that you are requesting.
AWS uses the security credentials to authenticate and authorize your requests.

When a new connection to IaSQL is issued, the AWS credentials are stored.
The keys can be generated from the AWS console for each registered user

**`Example`**

```sql TheButton[Add new credentials]="Add new credentials"
 INSERT INTO aws_credentials (access_key_id, secret_access_key)
 VALUES ('AKIA...', '<your secret access key>');

 SELECT * FROM aws_credentials;
```

**`See`**

 - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-account-integration.ts#L62
 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-account-integration.ts#L95

## Columns

• **access\_key\_id**: `string`

AWS Access Key

• **secret\_access\_key**: `string`

AWS Secret Access Key
