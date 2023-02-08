---
id: "aws_acm"
title: "aws_acm"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="Components" label="Components" default>

### Tables

    [certificate](../../classes/aws_acm_entity_certificate.Certificate)

### Functions
    [certificate_import](../../classes/aws_acm_rpcs_import.CertificateImportRpc)

    [certificate_request](../../classes/aws_acm_rpcs_request.CertificateRequestRpc)

### Enums
    [certificate_renewal_eligibility](../../enums/aws_acm_entity_certificate.certificateRenewalEligibilityEnum)

    [certificate_status](../../enums/aws_acm_entity_certificate.certificateStatusEnum)

    [certificate_type](../../enums/aws_acm_entity_certificate.certificateTypeEnum)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

```testdoc
modules/aws-acm-list-integration.ts#AwsAcm List Integration Testing#Managing certificates
modules/aws-acm-import-integration.ts#AwsAcm Import Integration Testing#Importing a certificate
modules/aws-acm-request-integration.ts#AwsAcm Request Integration Testing#Requesting a certificate
```

</TabItem>
</Tabs>
