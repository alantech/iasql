---
id: "iasql_functions_rpcs_iasql_uninstall.IasqlUninstall"
title: "Method: iasql_uninstall"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
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
SELECT * FROM iasql_uninstall('aws_ec2');
```

**`See`**

https://iasql.com/docs/module/

## Columns
