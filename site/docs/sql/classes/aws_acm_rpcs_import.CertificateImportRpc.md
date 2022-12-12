---
id: "aws_acm_rpcs_import.CertificateImportRpc"
title: "Table: certificate_import"
sidebar_label: "certificate_import"
custom_edit_url: null
---

Method for importing an AWS certificate, based on a local one.

Returns following columns:

arn: The unique ARN for the imported certificate

status: OK if the certificate was imported successfully

message: Error message in case of failure

**`Example`**

```sql
  SELECT * FROM certificate_import('***your_certificate_content***', '***your_key_content***', 'us-east-2', '');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-acm-import-integration.ts#L86
 - https://aws.amazon.com/certificate-manager

## Columns

___
