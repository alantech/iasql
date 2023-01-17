---
id: "aws_acm_entity_certificate.Certificate"
title: "Table: certificate"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to query for all AWS certificates in the system, managed by AWS ACM.
AWS Certificate Manager (ACM) handles the complexity of creating, storing, and renewing public
and private SSL/TLS X.509 certificates and keys that protect your AWS websites and applications.

This table is used to list the existing certificates and be able to delete them. Certificates
can be created or imported by using the following postgres functions:

**`See`**

 - https://iasql.com/docs/sql/classes/aws_acm_rpcs_import.CertificateImportRpc/
 - https://iasql.com/docs/sql/classes/aws_acm_rpcs_request.CertificateRequestRpc/
 - https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
 - https://aws.amazon.com/certificate-manager

**`Example`**

```sql TheButton[Show certificates for domain]="Show certificates for domain"
  SELECT * FROM certificate WHERE domain_name = 'domain.com';
```

## Columns

• `Optional` **arn**: `string`

ARN for the generated certificate

• `Optional` **certificate\_id**: `string`

AWS generated ID for the certificate

• `Optional` **certificate\_type**: [`certificate_type`](../enums/aws_acm_entity_certificate.certificateTypeEnum.md)

Type of certificate

• **domain\_name**: `string`

Domain name to which the certificate was issued

• **in\_use**: `boolean`

Specifies if the certificate is already in use

• **region**: `string`

Region for the certificate creation

• `Optional` **renewal\_eligibility**: [`certificate_renewal_eligibility`](../enums/aws_acm_entity_certificate.certificateRenewalEligibilityEnum.md)

Specifies if the certificate can be renewed or not

• `Optional` **status**: [`certificate_status`](../enums/aws_acm_entity_certificate.certificateStatusEnum.md)

Status of the certificate
