---
id: "aws_ec2_rpcs_request.KeyPairRequestRpc"
title: "Table: key_pair_request"
sidebar_label: "key_pair_request"
custom_edit_url: null
---

Method for requesting a new EC2 keypair

Returns following columns:

- name: The name for the created key
- status: OK if the certificate was imported successfully
- message: Error message in case of failure

**`Example`**

```sql
  SELECT * FROM certificate_request('fakeDomain.com', 'DNS', 'us-east-2', '');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ec2-integration.ts#L269
 - https://aws.amazon.com/certificate-manager

## Columns
