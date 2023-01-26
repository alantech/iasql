---
id: "aws_ec2_rpcs_import.KeyPairImportRpc"
title: "Method: key_pair_import"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method for importing EC2 keypairs, based on a local one.

Returns following columns:

- name: The name for the created key
- status: OK if the certificate was imported successfully
- message: Error message in case of failure

**`Example`**

```sql TheButton[Import an EC2 keypair]="Import an EC2 keypair"
SELECT * FROM key_pair_import ('test-key', '<content_for_ssh_key>', 'us-east-1');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ec2-integration.ts#L320
 - https://docs.aws.amazon.com/cli/latest/reference/ec2/import-key-pair.html
