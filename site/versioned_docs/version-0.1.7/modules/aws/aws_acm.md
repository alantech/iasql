---
id: "aws_acm"
title: "aws_acm"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [certificate](../../aws/tables/aws_acm_entity_certificate.Certificate)

### Functions
    [certificate_import](../../aws/tables/aws_acm_rpcs_import.CertificateImportRpc)

    [certificate_request](../../aws/tables/aws_acm_rpcs_request.CertificateRequestRpc)

### Enums
    [certificate_renewal_eligibility](../../aws/enums/aws_acm_entity_certificate.certificateRenewalEligibilityEnum)

    [certificate_status](../../aws/enums/aws_acm_entity_certificate.certificateStatusEnum)

    [certificate_type](../../aws/enums/aws_acm_entity_certificate.certificateTypeEnum)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

```testdoc
modules/aws-acm-list-integration.ts#AwsAcm List Integration Testing#Managing certificates
modules/aws-acm-import-integration.ts#AwsAcm Import Integration Testing#Importing a certificate
modules/aws-acm-request-integration.ts#AwsAcm Request Integration Testing#Requesting a certificate
```

</TabItem>
</Tabs>
