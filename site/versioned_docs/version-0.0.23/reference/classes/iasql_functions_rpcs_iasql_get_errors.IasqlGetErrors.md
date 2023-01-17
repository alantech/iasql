---
id: "iasql_functions_rpcs_iasql_get_errors.IasqlGetErrors"
title: "Method: iasql_get_errors"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method to list the error messages produced in a transaction by `iasql_commit` or `iasql_rollback`

**`See`**

https://iasql.com/docs/transaction

Returns following columns:
- ts: Error message timestamp
- message: Error message

**`Example`**

```sql
SELECT * FROM iasql_get_errors();
```

## Columns
