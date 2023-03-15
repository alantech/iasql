---
id: "aws_vpc_entity_nat_gateway.NatGateway"
title: "nat_gateway"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS NAT Gateway instances.
A NAT gateway is a Network Address Translation (NAT) service.
You can use a NAT gateway so that instances in a private subnet can connect to services
outside your VPC but external services cannot initiate a connection with those instances.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html

## Columns

• **connectivity\_type**: [`connectivity_type`](../enums/aws_vpc_entity_nat_gateway.ConnectivityType.md)

Connectivity type for this NAT gateway

• `Optional` **elastic\_ip**: [`elastic_ip`](aws_vpc_entity_elastic_ip.ElasticIp.md)

Reference to the elastic IP used by this NAT gateway

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html

• `Optional` **nat\_gateway\_id**: `string`

AWS ID to identify the NAT gateway

• **region**: `string`

Reference to the region where it belongs

• `Optional` **state**: [`nat_gateway_state`](../enums/aws_vpc_entity_nat_gateway.NatGatewayState.md)

Current state for the gateway

• `Optional` **subnet**: [`subnet`](aws_vpc_entity_subnet.Subnet.md)

Reference to the associated subnets for the NAT gateway

**`See`**

https://aws.amazon.com/premiumsupport/knowledge-center/nat-gateway-vpc-private-subnet/

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the gateway

#### Type definition

▪ [key: `string`]: `string`
