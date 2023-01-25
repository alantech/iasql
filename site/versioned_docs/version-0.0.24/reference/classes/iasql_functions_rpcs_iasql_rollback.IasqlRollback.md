---
id: "iasql_functions_rpcs_iasql_rollback.IasqlRollback"
title: "Method: iasql_rollback"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method to abort an IaSQL transaction if you want to discard the changes done since calling `iasql_begin` by
calling `iasql_rollback`. This will re-enable regular behaviour of IaSQL in which changes are propagated
both ways in an eventually consistent way without any special syntax other than
`SELECT/INSERT/UPDATE/DELETE` records normally.

Returns following columns:
- action: The action issued in the db
- table_name: Table that was affected
- id: the ID of the generated change
- description: A description of the generated change

**`Example`**

```sql
SELECT * FROM iasql_rollback();
```

**`See`**

https://iasql.com/docs/transaction/

## Columns
