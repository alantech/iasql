---
id: "aws_acm_rpcs_import.CertificateImportRpc"
title: "certificate_import"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for importing an AWS certificate, based on a local one.

Returns following columns:

- arn: The unique ARN for the imported certificate

- status: OK if the certificate was imported successfully

- message: Error message in case of failure

**`See`**

https://aws.amazon.com/certificate-manager
