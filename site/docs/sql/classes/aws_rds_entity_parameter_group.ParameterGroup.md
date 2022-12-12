---
id: "aws_rds_entity_parameter_group.ParameterGroup"
title: "Table: parameter_group"
sidebar_label: "parameter_group"
custom_edit_url: null
---

Table to manage AWS RDS parameter groups

**`Example`**

```sql
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

___

• **description**: `string`

Description for the parameter group

___

• **family**: [`parameter_group_family`](../enums/aws_rds_entity_parameter_group.ParameterGroupFamily.md)

Family for the parameter group

___

• **name**: `string`

Name for the parameter group

___

• `Optional` **parameters**: `parameter`[]

Complex type to represent the list of parameters for the group

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ParamValuesRef.html

___

• **region**: `string`

Region for the instance
