---
id: "aws_acm_rpcs_request.CertificateRequestRpc"
title: "certificate_request"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for requesting a new AWS certificate for a given domain. The certificate will be automatically validated
via DNS method

Returns following columns:

- arn: The unique ARN for the imported certificate

- status: OK if the certificate was imported successfully

- message: Error message in case of failure

**`See`**

https://aws.amazon.com/certificate-manager
