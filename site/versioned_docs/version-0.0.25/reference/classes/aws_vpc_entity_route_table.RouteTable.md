---
id: "aws_vpc_entity_route_table.RouteTable"
title: "Table: route_table"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS route tables.
A route table contains a set of rules, called routes, that determine where network traffic from your subnet or gateway is directed.

**`Example`**

```sql TheButton[Creates a Route table]="Creates a Route table"
INSERT INTO route_table (vpc_id, tags, region) VALUES
((SELECT id FROM vpc WHERE tags ->> 'name' = 'vpc'), '{"name":"route_table"}', 'us-east-1');
```

**`See`**

 - https://github.com/iasql/iasql/blob/main/test/modules/aws-vpc-routetable-integration.ts#L154
 - https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html

## Columns

• **associations**: [`route_table_association`](aws_vpc_entity_route_table_association.RouteTableAssociation.md)[]

Reference to all the associations for this route table

• **region**: `string`

Reference to the region where it belongs

• `Optional` **route\_table\_id**: `string`

AWS ID to identify the route table

• **routes**: [`route`](aws_vpc_entity_route.Route.md)[]

Reference to all the routes that belong to this table

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the route table

#### Type definition

▪ [key: `string`]: `string`

• **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated with this route table
