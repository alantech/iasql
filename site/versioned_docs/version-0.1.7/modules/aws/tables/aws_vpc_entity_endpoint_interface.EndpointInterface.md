---
id: "aws_vpc_entity_endpoint_interface.EndpointInterface"
title: "endpoint_interface"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Interface endpoints, using PrivateLink.
AWS PrivateLink is a highly available, scalable technology that enables you to privately
connect your VPC to services as if they were in your VPC.

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html

## Columns

• **dns\_name\_record\_type**: `dns_record_ip_type`

Type of DNS record to use for exposing the endpoint

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/enums/dnsrecordiptype.html

• `Optional` **policy**: `policy`

Complex type representing the policy associated to this endpoint

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-access.html

• **private\_dns\_enabled**: `boolean`

Specifies if the endpoint is using private DNS resolution

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/manage-dns-names.html

• **region**: `string`

Reference to the region where it belongs

• **service**: [`endpoint_interface_service`](../enums/aws_vpc_entity_endpoint_interface.EndpointInterfaceService.md)

Service type associated to this endpoint

• `Optional` **state**: `string`

Current state for the endpoint

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html

• **subnets**: [`subnet`](aws_vpc_entity_subnet.Subnet.md)[]

Reference to the subnets associated with this endpoint

**`See`**

https://docs.aws.amazon.com/vpc/latest/privatelink/interface-endpoints.html#add-remove-subnets

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the gateway

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated to this endpoint

• `Optional` **vpc\_endpoint\_id**: `string`

AWS ID to identify the endpoint
