---
id: "aws_vpc_entity_route_table.RouteTable"
title: "route_table"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS route tables.
A route table contains a set of rules, called routes, that determine where network traffic from your subnet or gateway is directed.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html

## Columns

• **associations**: [`route_table_association`](aws_vpc_entity_route_table_association.RouteTableAssociation.md)[]

Reference to all the associations for this route table

• **region**: `string`

Reference to the region where it belongs

• `Optional` **route\_table\_id**: `string`

AWS ID to identify the route table

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the route table

#### Type definition

▪ [key: `string`]: `string`

• **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated with this route table
