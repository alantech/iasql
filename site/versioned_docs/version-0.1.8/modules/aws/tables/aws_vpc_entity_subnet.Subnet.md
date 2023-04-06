---
id: "aws_vpc_entity_subnet.Subnet"
title: "subnet"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS subnet entries.
A subnet is a range of IP addresses in your VPC. You can launch AWS resources into a specified subnet.
Use a public subnet for resources that must be connected to the internet, and a private subnet for
resources that won't be connected to the internet.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html

## Columns

• **availability\_zone**: [`availability_zone`](aws_vpc_entity_availability_zone.AvailabilityZone.md)

Reference to the availability zone associated with this subnet

• `Optional` **available\_ip\_address\_count**: `number`

The number of IPv4 addresses in the subnet that are available.

• `Optional` **cidr\_block**: `string`

The IPv4 CIDR block of the subnet. The CIDR block you specify must exactly match the subnet's CIDR block
for information to be returned for the subnet. You can also use cidr or cidrBlock as the filter names.

• `Optional` **explicit\_route\_table\_associations**: [`route_table_association`](aws_vpc_entity_route_table_association.RouteTableAssociation.md)[]

Reference to the route table associations for this subnet

• `Optional` **network\_acl**: [`network_acl`](aws_vpc_entity_network_acl.NetworkAcl.md)

Reference to the network ACL associated to that subnet

• `Optional` **owner\_id**: `string`

The AWS account ID for the owner of this subnet

• **region**: `string`

Reference to the region where it belongs

• `Optional` **state**: [`subnet_state`](../enums/aws_vpc_entity_subnet.SubnetState.md)

Current state of the subnet

• `Optional` **subnet\_arn**: `string`

AWS ARN used to identify the subnet

• `Optional` **subnet\_id**: `string`

AWS ID used to identify the subnet

• **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated with this subnet
