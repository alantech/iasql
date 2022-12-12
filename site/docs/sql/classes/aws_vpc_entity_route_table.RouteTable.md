---
id: "aws_vpc_entity_route_table.RouteTable"
title: "Table: route_table"
sidebar_label: "route_table"
custom_edit_url: null
---

Table to manage AWS route tables.
A route table contains a set of rules, called routes, that determine where network traffic from your subnet or gateway is directed.

**`Example`**

```sql
INSERT INTO route_table (vpc_id, tags, region) VALUES
((SELECT id FROM vpc WHERE tags ->> 'name' = 'vpc'), '{"name":"route_table"}', 'us-east-1');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-routetable-integration.ts#L154
 - https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html

## Columns

• **associations**: [`route_table_association`](aws_vpc_entity_route_table_association.RouteTableAssociation.md)[]

Reference to all the associations for this route table

___

• **region**: `string`

Reference to the region where it belongs

___

• `Optional` **route\_table\_id**: `string`

AWS ID to identify the route table

___

• **routes**: [`route`](aws_vpc_entity_route.Route.md)[]

Reference to all the routes that belong to this table

___

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the route table

#### Index signature

▪ [key: `string`]: `string`

___

• **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated with this route table
