---
id: "aws_memory_db_entity_subnet_group.SubnetGroup"
title: "subnet_group"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage Memory DB subnet groups. A subnet group is a collection of subnets (typically private) that you can
designate for your clusters running in an Amazon Virtual Private Cloud (VPC) environment.
When you create a cluster in an Amazon VPC, you can specify a subnet group or use the default one provided.
MemoryDB uses that subnet group to choose a subnet and IP addresses within that subnet to associate with your nodes.

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/subnetgroups.html

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
