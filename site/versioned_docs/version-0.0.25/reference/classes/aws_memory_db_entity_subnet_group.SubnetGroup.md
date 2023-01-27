---
id: "aws_memory_db_entity_subnet_group.SubnetGroup"
title: "Table: subnet_group"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage Memory DB subnet groups. A subnet group is a collection of subnets (typically private) that you can
designate for your clusters running in an Amazon Virtual Private Cloud (VPC) environment.
When you create a cluster in an Amazon VPC, you can specify a subnet group or use the default one provided.
MemoryDB uses that subnet group to choose a subnet and IP addresses within that subnet to associate with your nodes.

**`Example`**

```sql TheButton[Manage a MemoryDB subnet group]="Manage a MemoryDB subnet group"
INSERT INTO subnet_group (subnet_group_name) VALUES ('subnet_group');
SELECT * FROM subnet_group WHERE subnet_group_name = 'subnet_group';
DELETE FROM subnet_group WHERE subnet_group_name = 'subnet_group';
```

**`See`**

 - https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-memory-db-integration.ts#L109
 - https://docs.aws.amazon.com/memorydb/latest/devguide/subnetgroups.html

## Columns

• `Optional` **arn**: `string`

AWS ARN for the subnet group

• `Optional` **description**: `string`

Description for the subnet group

• **region**: `string`

Region for the subnet group

• **subnet\_group\_name**: `string`

Name for the subnet group

• `Optional` **subnets**: `string`[]

List of subnets associated with the group
