---
id: "aws_vpc_entity_endpoint_gateway.EndpointGateway"
title: "Table: endpoint_gateway"
sidebar_label: "endpoint_gateway"
custom_edit_url: null
---

Table to manage AWS Gateway endpoints.
Gateway endpoints provide reliable connectivity to Amazon S3 and DynamoDB without requiring an internet gateway or a NAT device for your VPC.
Gateway endpoints do not enable AWS PrivateLink.

**`Example`**

```sql
INSERT INTO endpoint_gateway (service, vpc_id, tags) SELECT 's3', id, '{"Name": "s3_gateway"}'
FROM vpc WHERE is_default = false AND cidr_block = '191.0.0.0/16';
SELECT * FROM endpoint_gateway WHERE tags ->> 'name' = 's3_gateway';
DELETE FROM endpoint_gateway WHERE tags ->> 'name' = 's3_gateway';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-integration.ts#L437
 - https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html

## Columns

• `Optional` **policy\_document**: `string`

Complex type representing the policy associated to this gateway

**`See`**

https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-resource-policies-examples.html

___

• **region**: `string`

Reference to the region where it belongs

___

• `Optional` **route\_table\_ids**: `string`[]

Complex type representing the route tables associated with this gateway

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html#gateway-endpoint-routing
TODO: update to be a reference to a RouteTable entity

___

• **service**: [`endpoint_gateway_service`](../enums/aws_vpc_entity_endpoint_gateway.EndpointGatewayService.md)

Service type associated to this gateway

___

• `Optional` **state**: `string`

Current state for the gateway

___

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the instance

#### Index signature

▪ [key: `string`]: `string`

___

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated to this gateway

___

• `Optional` **vpc\_endpoint\_id**: `string`

AWS ID to identify the gateway
