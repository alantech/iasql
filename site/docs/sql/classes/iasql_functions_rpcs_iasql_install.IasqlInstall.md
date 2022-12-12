---
id: "iasql_functions_rpcs_iasql_install.IasqlInstall"
title: "Table: iasql_install"
sidebar_label: "iasql_install"
custom_edit_url: null
---

Method to install the IaSQL modules provided by the engine

Returns following columns:
- module_name: Name of the module that was installed
- created_table_name: Name of the associated table that was created
- record_count: Total of registers added

Accepts the following parameters:
- list of modules to install

**`Example`**

```sql
SELECT * FROM iasql_install('aws_account');
```

**`See`**

https://github.com/iasql/iasql-engine/blob/main/site/docs/reference/function.md

## Columns
