---
id: "iasql_functions_rpcs_iasql_modules_list.IasqlModulesList"
title: "Table: iasql_modules_list"
sidebar_label: "iasql_modules_list"
custom_edit_url: null
---

Method to list all the installed modules

Returns following columns:
- module_name: Name of the module that was installed
- module_version: Version of the modules that was installed
- dependencies: complex type representing the dependencies for the module

**`Example`**

```sql
SELECT * FROM iasql_preview_apply()
```

**`See`**

https://github.com/iasql/iasql-engine/blob/main/site/docs/reference/function.md

## Columns
