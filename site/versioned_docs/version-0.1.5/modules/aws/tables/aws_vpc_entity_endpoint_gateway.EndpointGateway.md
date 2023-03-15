---
id: "aws_vpc_entity_endpoint_gateway.EndpointGateway"
title: "endpoint_gateway"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Gateway endpoints.
Gateway endpoints provide reliable connectivity to Amazon S3 and DynamoDB without requiring an internet gateway or a NAT device for your VPC.
Gateway endpoints do not enable AWS PrivateLink.

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html

## Columns

• `Optional` **policy**: `policy`

Complex type representing the policy associated to this gateway

**`See`**

https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-resource-policies-examples.html

• **region**: `string`

Reference to the region where it belongs

• `Optional` **route\_table\_ids**: `string`[]

Complex type representing the route tables associated with this gateway

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html#gateway-endpoint-routing

• **service**: [`endpoint_gateway_service`](../enums/aws_vpc_entity_endpoint_gateway.EndpointGatewayService.md)

Service type associated to this gateway

• `Optional` **state**: `string`

Current state for the gateway

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the instance

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated to this gateway

• `Optional` **vpc\_endpoint\_id**: `string`

AWS ID to identify the gateway
