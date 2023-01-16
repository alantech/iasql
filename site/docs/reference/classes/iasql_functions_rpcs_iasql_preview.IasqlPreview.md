---
id: "iasql_functions_rpcs_iasql_preview.IasqlPreview"
title: "Method: iasql_preview"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method to visualize proposed changes for an ongoing IaSQL transaction to see how the database will update
the cloud with the new data model using the `iasql_preview` function which returns a virtual table of database records.

Returns following columns:
- action: The action issued in the db
- table_name: Table that was affected
- id: the ID of the generated change
- description: A description of the generated change

**`Example`**

```sql
SELECT * FROM iasql_preview();
```

**`See`**

https://iasql.com/docs/transaction/

## Columns
