---
id: "aws_vpc_entity_subnet.Subnet"
title: "Table: subnet"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS subnet entries.
A subnet is a range of IP addresses in your VPC. You can launch AWS resources into a specified subnet.
Use a public subnet for resources that must be connected to the internet, and a private subnet for
resources that won't be connected to the internet.

**`Example`**

```sql TheButton[Creates a subnet]="Creates a subnet"
 INSERT INTO subnet (availability_zone, vpc_id, cidr_block) SELECT 'us-east-1a', id, '192.0.0.0/16'
FROM vpc WHERE is_default = false AND cidr_block = '192.0.0.0/16';
```

**`See`**

 - https://github.com/iasql/iasql/blob/main/test/modules/aws-vpc-integration.ts#L178L182
 - https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html

## Columns

• **availability\_zone**: [`availability_zone`](aws_vpc_entity_availability_zone.AvailabilityZone.md)

Reference to the availability zone associated with this subnet

• `Optional` **available\_ip\_address\_count**: `number`

The number of IPv4 addresses in the subnet that are available.

• `Optional` **cidr\_block**: `string`

The IPv4 CIDR block of the subnet. The CIDR block you specify must exactly match the subnet's CIDR block
for information to be returned for the subnet. You can also use cidr or cidrBlock as the filter names.

• `Optional` **explicit\_route\_table\_associations**: [`route_table_association`](aws_vpc_entity_route_table_association.RouteTableAssociation.md)[]

Reference to the route table associations for this subnet

• `Optional` **owner\_id**: `string`

The AWS account ID for the owner of this subnet

• **region**: `string`

Reference to the region where it belongs

• `Optional` **state**: [`subnet_state`](../enums/aws_vpc_entity_subnet.SubnetState.md)

Current state of the subnet

• `Optional` **subnet\_arn**: `string`

AWS ARN used to identify the subnet

• `Optional` **subnet\_id**: `string`

AWS ID used to identify the subnet

• **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated with this subnet
