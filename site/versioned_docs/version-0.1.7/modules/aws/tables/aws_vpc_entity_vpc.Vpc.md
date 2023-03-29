---
id: "aws_vpc_entity_vpc.Vpc"
title: "vpc"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS VPC entries.
Amazon Virtual Private Cloud (Amazon VPC) gives you full control over your virtual networking
environment, including resource placement, connectivity, and security.

**`See`**

https://aws.amazon.com/vpc/

## Columns

• **cidr\_block**: `string`

Amazon VPC supports IPv4 and IPv6 addressing. A VPC must have an IPv4 CIDR block associated with it.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/configure-your-vpc.html#vpc-cidr-blocks

• `Optional` **dhcp\_options**: [`dhcp_options`](aws_vpc_entity_dhcp_options.DhcpOptions.md)

The set of DHCP options you've associated with the VPC

• **enable\_dns\_hostnames**: `boolean`

Determines whether the VPC supports assigning public DNS hostnames to instances with public IP addresses.
The default for this attribute is false unless the VPC is a default VPC.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/vpc-dns.html#vpc-dns-hostnames

• **enable\_dns\_support**: `boolean`

Determines whether the VPC supports DNS resolution through the Amazon provided DNS server.
If this attribute is true, queries to the Amazon provided DNS server succeed.
For more information, see Amazon DNS server. The default for this attribute is true.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/vpc-dns.html#vpc-dns-hostnames

• **enable\_network\_address\_usage\_metrics**: `boolean`

Defines if Network Address Usage (NAU) is enabled. NAU is a metric applied to resources
in your virtual network to help you plan for and monitor the size of your VPC.
Each NAU unit contributes to a total that represents the size of your VPC.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/network-address-usage.html

• **is\_default**: `boolean`

Whether this VPC is the default one
When you start using Amazon VPC, you have a default VPC in each AWS Region.
A default VPC comes with a public subnet in each Availability Zone,
an internet gateway, and settings to enable DNS resolution.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/default-vpc.html

• **region**: `string`

Reference to the region where it belongs

• `Optional` **state**: [`vpc_state`](../enums/aws_vpc_entity_vpc.VpcState.md)

Current state for the VPC

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the VPC

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **vpc\_id**: `string`

AWS ID used to identify the VPC
