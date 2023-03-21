---
id: "aws_rds_entity_db_subnet_group.DBSubnetGroup"
title: "db_subnet_group"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS RDS subnet groups. DB subnet groups must contain at least one subnet in at
least two AZs in the Amazon Web Services Region.

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html

## Columns

• `Optional` **arn**: `string`

AWS ARN for the subnet group

• **description**: `string`

Description for the subnet group

• **name**: `string`

Name for the subnet group

• **region**: `string`

Region for the instance

• `Optional` **subnets**: `string`[]

List of subnets associated with the group
