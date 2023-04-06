---
id: "aws_vpc_entity_dhcp_options.DhcpOptions"
title: "dhcp_options"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS DHCP options sets.
DHCP option sets give you control over the following aspects of routing in your virtual network

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/VPC_DHCP_Options.html

## Columns

• `Optional` **dhcp\_configurations**: { `key`: `string` ; `values`: `attribute_value`[]  }[]

List of DHCP configuration options

• `Optional` **dhcp\_options\_id**: `string`

AWS ID to identify the DHCP option set

• **region**: `string`

Reference to the region where it belongs

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the instance

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/tag.html

#### Type definition

▪ [key: `string`]: `string`
