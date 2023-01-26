---
id: "aws_vpc_entity_route_table_association.RouteTableAssociation"
title: "Table: route_table_association"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage associations between a Route and a Route table.

**`Example`**

```sql TheButton[Manage Route Table associations]="Manage Route Table associations"
INSERT INTO route_table_association (route_table_id, vpc_id, subnet_id) VALUES
((SELECT id FROM route_table WHERE tags ->> 'name' = 'route_table'),
(SELECT id FROM vpc WHERE tags ->> 'name' = 'vpc'),
(SELECT id FROM subnet WHERE cidr_block = '10.0.1.0/24' AND availability_zone = 'us-east-1a'));
SELECT * FROM route_table_association WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = 'route_table');

DELETE FROM route_table_association WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = 'route_table');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-routetable-integration.ts#L197
 - https://docs.aws.amazon.com/vpc/latest/userguide/WorkWithRouteTables.html

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
