---
id: "aws_vpc_entity_network_acl.NetworkAcl"
title: "network_acl"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Columns

• `Optional` **entries**: `network_acl_entry`[]

One or more entries (rules) in the network ACL.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html#nacl-rules

• `Optional` **network\_acl\_id**: `string`

AWS ID to identify the Network ACL

• **region**: `string`

Reference to the region where it belongs

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the instance

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/tag.html

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated to this endpoint
