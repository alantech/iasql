---
id: "aws_dynamo_entity.DynamoTable"
title: "Table: dynamo_table"
sidebar_label: "dynamo_table"
custom_edit_url: null
---

Table to manage AWS Dynamo DB tables.

**`Example`**

```sql
INSERT INTO dynamo_table (table_name, table_class, throughput, primary_key)
VALUES ('dynamo-table', 'STANDARD','"PAY_PER_REQUEST"', '{"key": "S", "val": "S"}');
SELECT * FROM dynamo_table  WHERE table_name = 'dynamo-table';
DELETE FROM dynamo_table WHERE table_name = 'dynamo-table';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-dynamo-integration.ts#L90
 - https://aws.amazon.com/dynamodb/

## Columns

• `Optional` **created\_at**: `date`

Creation time

___

• **primary\_key**: `Object`

Complex type to define the primary key for the table

**`See`**

https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html#HowItWorks.CoreComponents.PrimaryKey

TODO: How to constrain this more appropriately in the database?
https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
This was really hard to find to figure out the correct strings to shove in here
TODO2: How to constrain to just two keys?

#### Index signature

▪ [key: `string`]: ``"B"`` \| ``"BOOL"`` \| ``"BS"`` \| ``"L"`` \| ``"M"`` \| ``"N"`` \| ``"NS"`` \| ``"NULL"`` \| ``"S"`` \| ``"SS"``

___

• **region**: `string`

Region for the Codedeploy deployment group

___

• **table\_class**: [`table_class`](../enums/aws_dynamo_entity.TableClass.md)

Class for the table

___

• `Optional` **table\_id**: `string`

Internal AWS ID for the table

___

• **table\_name**: `string`

Name for the Dynamo table

___

• **throughput**: { `read_capacity_units`: `number` ; `write_capacity_units`: `number`  } \| ``"PAY_PER_REQUEST"``

Complex type to represent the provisioned throughput settings for the table
TODO: How to constrain this more appropriately in the database?

**`See`**

https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ProvisionedThroughput.html
