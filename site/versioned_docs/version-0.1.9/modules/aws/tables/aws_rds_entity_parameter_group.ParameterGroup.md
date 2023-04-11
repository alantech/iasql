---
id: "aws_rds_entity_parameter_group.ParameterGroup"
title: "parameter_group"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS RDS parameter groups. Database parameters specify how the database is configured.
For example, database parameters can specify the amount of resources, such as memory, to allocate to a database.

A DB parameter group acts as a container for engine configuration values that are applied to one or more DB instances.

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html

## Columns

• `Optional` **arn**: `string`

AWS ARN for the parameter group

• **description**: `string`

Description for the parameter group

• **family**: [`parameter_group_family`](../enums/aws_rds_entity_parameter_group.ParameterGroupFamily.md)

Family for the parameter group

• **name**: `string`

Name for the parameter group

• `Optional` **parameters**: `parameter`[]

Complex type to represent the list of parameters for the group

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ParamValuesRef.html

• **region**: `string`

Region for the instance
