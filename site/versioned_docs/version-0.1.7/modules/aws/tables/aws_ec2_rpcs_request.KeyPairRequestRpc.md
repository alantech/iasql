---
id: "aws_ec2_rpcs_request.KeyPairRequestRpc"
title: "key_pair_request"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for requesting a new EC2 keypair

Returns following columns:

- name: The name for the created key
- status: OK if the key was created successfully
- message: Error message in case of failure
- privateKey: Content of the private key. You will need to store it safely, as it won't be stored and shown again.

**`See`**

https://docs.aws.amazon.com/cli/latest/reference/ec2/create-key-pair.html
