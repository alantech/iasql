---
id: "iasql_functions_rpcs_iasql_modules_list.IasqlModulesList"
title: "Method: iasql_modules_list"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method to list all the installed modules

Returns following columns:
- module_name: Name of the module that was installed
- module_version: Version of the modules that was installed
- dependencies: complex type representing the dependencies for the module

**`Example`**

```sql
SELECT * FROM iasql_modules_list();
```

**`See`**

https://iasql.com/docs/module/

## Columns
