---
id: "aws_dynamo_entity.DynamoTable"
title: "dynamo_table"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Dynamo DB tables. Amazon DynamoDB is a fully managed, serverless, key-value
NoSQL database designed to run high-performance applications at any scale. DynamoDB offers built-in security,
continuous backups, automated multi-Region replication, in-memory caching, and data import and export tools.

**`See`**

https://aws.amazon.com/dynamodb/

## Columns

• `Optional` **created\_at**: `date`

Creation time

• **primary\_key**: `Object`

Complex type to define the primary key for the table

**`See`**

https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html#HowItWorks.CoreComponents.PrimaryKey

#### Type definition

▪ [key: `string`]: `B` \| `BOOL` \| `BS` \| `L` \| `M` \| `N` \| `NS` \| `NULL` \| `S` \| `SS`

• **region**: `string`

Region for the Codedeploy deployment group

• **table\_class**: [`table_class`](../enums/aws_dynamo_entity.TableClass.md)

Class for the table

• `Optional` **table\_id**: `string`

Internal AWS ID for the table

• **table\_name**: `string`

Name for the Dynamo table

• **throughput**: { `read_capacity_units`: `number` ; `write_capacity_units`: `number`  } \| `PAY_PER_REQUEST`

Complex type to represent the provisioned throughput settings for the table

**`See`**

https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_ProvisionedThroughput.html
