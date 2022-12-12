---
id: "aws_acm_entity_certificate.Certificate"
title: "Table: certificate"
sidebar_label: "certificate"
custom_edit_url: null
---

Table to query for all AWS certificates in the system, managed by AWS ACM.
Certificates can be read and deleted, but not created or modified. Instead certificates can be
created or imported by using the following postgres functions:

**`See`**

 - https://iasql.com/docs/sql/classes/aws_acm_rpcs_import.CertificateImportRpc/
 - https://iasql.com/docs/sql/classes/aws_acm_rpcs_request.CertificateRequestRpc/
 - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
 - https://aws.amazon.com/certificate-manager

**`Example`**

```sql
  SELECT * FROM certificate WHERE domain_name = '${domainName}';
```

## Columns

• `Optional` **arn**: `string`

ARN for the generated certificate

___

• `Optional` **certificate\_id**: `string`

Internal ID for the certificate

___

• `Optional` **certificate\_type**: [`certificate_type`](../enums/aws_acm_entity_certificate.certificateTypeEnum.md)

Type of certificate

___

• **domain\_name**: `string`

Domain name to which the certificate was issued

___

• **in\_use**: `boolean`

Specifies if the certificate is already in use

___

• **region**: `string`

Region for the certificate creation

___

• `Optional` **renewal\_eligibility**: [`certificate_renewal_eligibility`](../enums/aws_acm_entity_certificate.certificateRenewalEligibilityEnum.md)

Specifies if the certificate can be renewed or not

___

• `Optional` **status**: [`certificate_status`](../enums/aws_acm_entity_certificate.certificateStatusEnum.md)

Status of the certificate
