---
id: "aws_account_entity.AwsCredentials"
title: "Table: aws_credentials"
sidebar_label: "aws_credentials"
custom_edit_url: null
---

Table that will hold the user's AWS credentials. When a new connection to IaSQL is issued,
the AWS credentials are stored.
The keys can be generated from the AWS console for each registered user

**`Example`**

```sql
 INSERT INTO aws_credentials (access_key_id, secret_access_key)
 VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')

 SELECT * FROM aws_credentials
```

**`See`**

 - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-account-integration.ts#L62
 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-account-integration.ts#L95

## Columns

• **access\_key\_id**: `string`

AWS Access Key

___

• **secret\_access\_key**: `string`

AWS Secret Access Key
