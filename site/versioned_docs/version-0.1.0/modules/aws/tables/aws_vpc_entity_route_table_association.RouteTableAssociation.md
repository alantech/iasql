---
id: "aws_vpc_entity_route_table_association.RouteTableAssociation"
title: "route_table_association"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage associations between a Route and a Route table.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/WorkWithRouteTables.html

## Columns

• **is\_main**: `boolean`

Whether this is the main route association
Main is the route table that automatically comes with your VPC.
It controls the routing for all subnets that are not explicitly associated with any other route table.

• **route\_table**: [`route_table`](aws_vpc_entity_route_table.RouteTable.md)

Reference to the route table for this association

• `Optional` **route\_table\_association\_id**: `string`

AWS ID to identify the route table association

• `Optional` **subnet**: [`subnet`](aws_vpc_entity_subnet.Subnet.md)

Your VPC has an implicit router, and you use route tables to control where network traffic is directed.
Each subnet in your VPC must be associated with a route table, which controls the routing for the subnet
(subnet route table).

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html#subnet-route-tables

• **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC for this association
