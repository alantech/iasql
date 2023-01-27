---
id: "aws_ec2_rpcs_request.KeyPairRequestRpc"
title: "Method: key_pair_request"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method for requesting a new EC2 keypair

Returns following columns:

- name: The name for the created key
- status: OK if the key was created successfully
- message: Error message in case of failure
- privateKey: Content of the private key. You will need to store it safely, as it won't be stored and shown again.

**`Example`**

```sql TheButton[Request an EC2 keypair]="Request an EC2 keypair"
SELECT * FROM key_pair_request ('key_name', 'us-east-1');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ec2-integration.ts#L269
 - https://docs.aws.amazon.com/cli/latest/reference/ec2/create-key-pair.html
