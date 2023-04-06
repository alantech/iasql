---
id: "aws_ec2_rpcs_import.KeyPairImportRpc"
title: "key_pair_import"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for importing EC2 keypairs, based on a local one.

Returns following columns:

- name: The name for the created key
- status: OK if the certificate was imported successfully
- message: Error message in case of failure

**`See`**

https://docs.aws.amazon.com/cli/latest/reference/ec2/import-key-pair.html
