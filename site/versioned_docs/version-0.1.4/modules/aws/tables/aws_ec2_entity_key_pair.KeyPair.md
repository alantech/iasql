---
id: "aws_ec2_entity_key_pair.KeyPair"
title: "key_pair"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage keypairs for EC2 instances. A key pair, consisting of a public key and a private key, is a set of
security credentials that you use to prove your identity when connecting to an Amazon EC2 instance.

Amazon EC2 stores the public key on your instance, and you store the private key.

Keys can only be listed and deleted.
The keypairs can be created using `key_pair_request` and `key_pair_import` methods.

**`See`**

 - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html
 - https://aws.amazon.com/ec2/features

## Columns

• `Optional` **fingerprint**: `string`

Generated fingerprint for the keypair

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/verify-keys.html

• `Optional` **key\_pair\_id**: `string`

AWS generated ID for the keypair

• **name**: `string`

Name for the EC2 keypair

• `Optional` **public\_key**: `string`

Public key for the keypair. This will be used to grant ssh access to the associated instances.

• **region**: `string`

Region for the keypair

• **type**: `key_type`

Type for the key

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/enums/keytype.html
