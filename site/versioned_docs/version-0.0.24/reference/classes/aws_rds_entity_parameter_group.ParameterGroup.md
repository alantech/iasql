---
id: "aws_rds_entity_parameter_group.ParameterGroup"
title: "Table: parameter_group"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS RDS parameter groups. Database parameters specify how the database is configured.
For example, database parameters can specify the amount of resources, such as memory, to allocate to a database.

A DB parameter group acts as a container for engine configuration values that are applied to one or more DB instances.

**`Example`**

```sql TheButton[Manage RDS parameter groups]="Manage RDS parameter groups"
INSERT INTO parameter_group (name, family, description) VALUES ('pg_name', 'postgres14', 'description');
SELECT params ->> 'ParameterValue' as value FROM parameter_group, jsonb_array_elements(parameters) as params
WHERE name = 'pg_name' AND params ->> 'DataType' = 'boolean' AND params ->> 'IsModifiable' = 'true';

DELETE FROM parameter_group WHERE name = 'pg_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-rds-integration.ts#L202
 - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithParamGroups.html

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
