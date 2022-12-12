---
id: "aws_vpc_entity_endpoint_interface.EndpointInterface"
title: "Table: endpoint_interface"
sidebar_label: "endpoint_interface"
custom_edit_url: null
---

Table to manage AWS Interface endpoints, using PrivateLink.
AWS PrivateLink is a highly available, scalable technology that enables you to privately
connect your VPC to services as if they were in your VPC.

**`Example`**

```sql
INSERT INTO endpoint_interface (service, vpc_id, tags) SELECT 'lambda', id, '{"Name": "lambda_vpc_endpoint"}'
FROM vpc WHERE is_default = false AND cidr_block = '191.0.0.0/16';
SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = 'lambda_vpc_endpoint';
DELETE FROM endpoint_interface WHERE tags ->> 'Name' = 'lambda_vpc_endpoint';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-integration.ts#L479
 - https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html

## Columns

• **dns\_name\_record\_type**: `dns_record_ip_type`

Type of DNS record to use for exposing the endpoint

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/enums/dnsrecordiptype.html

___

• `Optional` **policy\_document**: `string`

Complex type representing the policy associated to this endpoint

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-access.html

___

• **private\_dns\_enabled**: `boolean`

Specifies if the endpoint is using private DNS resolution

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/manage-dns-names.html

___

• **region**: `string`

Reference to the region where it belongs

___

• **service**: [`endpoint_interface_service`](../enums/aws_vpc_entity_endpoint_interface.EndpointInterfaceService.md)

Service type associated to this endpoint

___

• `Optional` **state**: `string`

Current state for the endpoint

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html

___

• **subnets**: [`subnet`](aws_vpc_entity_subnet.Subnet.md)[]

Reference to the subnets associated with this endpoint

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/interface-endpoints.html#add-remove-subnets

___

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the gateway

#### Index signature

▪ [key: `string`]: `string`

___

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated to this endpoint

___

• `Optional` **vpc\_endpoint\_id**: `string`

AWS ID to identify the endpoint
