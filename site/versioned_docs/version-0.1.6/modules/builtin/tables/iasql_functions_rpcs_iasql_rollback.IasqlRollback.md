---
id: "iasql_functions_rpcs_iasql_rollback.IasqlRollback"
title: "iasql_rollback"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to abort an IaSQL transaction if you want to discard the changes done since calling `iasql_begin` by
calling `iasql_rollback`. This will sync from your cloud and re-enable regular behaviour of IaSQL in which changes are propagated
both ways in an eventually consistent way without any special syntax other than
`SELECT/INSERT/UPDATE/DELETE` records normally.

Returns following columns:
- action: The action issued in the db
- table_name: Table that was affected
- id: the ID of the generated change
- description: A description of the generated change

**`See`**

https://iasql.com/docs/transaction/

• **documentation**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `description` | `string` |
| `sample_usage` | `string` |
