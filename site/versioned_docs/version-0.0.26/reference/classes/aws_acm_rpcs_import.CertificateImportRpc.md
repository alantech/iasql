---
id: "aws_acm_rpcs_import.CertificateImportRpc"
title: "certificate_import"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
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
