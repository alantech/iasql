---
id: "iasql_functions_rpcs_iasql_install.IasqlInstall"
title: "Method: iasql_install"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
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
SELECT * FROM iasql_install('aws_ec2');
```

**`See`**

https://iasql.com/docs/module/

## Columns
