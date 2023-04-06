---
id: "aws_vpc_entity_route.Route"
title: "route"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS routes. A route table contains a set of rules, called routes,
that determine where network traffic from your subnet or gateway is directed.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/route-table-options.html

## Columns

• `Optional` **carrier\_gateway\_id**: `string`

ID for the carrier gateway used by the route

• `Optional` **core\_network\_arn**: `string`

AWS ARN to identify the network for the route

• **destination**: `string`

destination field: used to determine the destination to be matched. Could be an IPv4 or IPv6 CIDR block or a prefixed list

• `Optional` **egress\_only\_internet\_gateway\_id**: `string`

Egress-only Internet Gateway is VPC component that allows outbound only communication to the
internet over IPv6, and prevents the Internet from initiating an IPv6 connection with your instances.

• `Optional` **gateway\_id**: `string`

ID for the gateway used to connect to internet

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html

• `Optional` **instance\_id**: `string`

ID for the referenced EC2 instance

• `Optional` **instance\_owner\_id**: `string`

ID for the EC2 instance owner

• `Optional` **local\_gateway\_id**: `string`

ID for the local gateway used by the route

• `Optional` **nat\_gateway\_id**: `string`

ID for the NAT gateway referenced by the route

• `Optional` **network\_interface\_id**: `string`

ID for the network interface gateway gateway used by the route

• **region**: `string`

Reference to the region where it belongs

• **route\_table**: [`route_table`](aws_vpc_entity_route_table.RouteTable.md)

Reference to the route table associated with this route

• `Optional` **transit\_gateway\_id**: `string`

ID for the transit gateway used by the route

• `Optional` **vpc\_peering\_connection\_id**: `string`

ID for the VPC peering connection used by the route
