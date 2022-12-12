---
id: "iasql_functions_rpcs_iasql_uninstall.IasqlUninstall"
title: "Table: iasql_uninstall"
sidebar_label: "iasql_uninstall"
custom_edit_url: null
---

Method to uninstall the IaSQL modules provided by the engine

Returns following columns:
- module_name: Name of the module that was uninstalled
- dropped_table_name: Name of the associated table that was deleted
- record_count: Total of registers deleted

Accepts the following parameters:
- list of modules to uninstall

**`Example`**

```sql
SELECT * FROM iasql_uninstall('aws_account');
```

**`See`**

https://github.com/iasql/iasql-engine/blob/main/site/docs/reference/function.md

## Columns
