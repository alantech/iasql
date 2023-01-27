---
id: "aws_acm_rpcs_request.CertificateRequestRpc"
title: "Method: certificate_request"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method for requesting a new AWS certificate for a given domain. The certificate will be automatically validated
via DNS method

Returns following columns:

- arn: The unique ARN for the imported certificate

- status: OK if the certificate was imported successfully

- message: Error message in case of failure

**`Example`**

```sql
  SELECT * FROM certificate_request('fakeDomain.com', 'DNS', 'us-east-2', '');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-acm-request-integration.ts#L83
 - https://aws.amazon.com/certificate-manager
