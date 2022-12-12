---
id: "aws_ec2_entity_key_pair.KeyPair"
title: "Table: key_pair"
sidebar_label: "key_pair"
custom_edit_url: null
---

Table to manage keypairs for EC2 instances. Keys can only be listed and delete.
The keypairs can be created using `key_pair_request` and `key_pair_import` methods.

**`Example`**

```sql
SELECT * FROM key_pair WHERE name = 'key';
DELETE FROM key_pair WHERE name = 'key';
```

**`See`**

 - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html
 - https://aws.amazon.com/ec2/features

## Columns

• `Optional` **fingerprint**: `string`

Generated fingerprint for the keypair

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/verify-keys.html

___

• `Optional` **key\_pair\_id**: `string`

Internal AWS ID for the keypair

___

• **name**: `string`

Name for the EC2 keypair

___

• `Optional` **public\_key**: `string`

Public key for the keypair. This will be used to grant ssh access to the associated instances.

___

• **region**: `string`

Region for the keypair

___

• **type**: `key_type`

Type for the key

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/enums/keytype.html
