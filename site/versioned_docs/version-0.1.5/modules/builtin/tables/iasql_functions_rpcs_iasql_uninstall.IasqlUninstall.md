---
id: "iasql_functions_rpcs_iasql_uninstall.IasqlUninstall"
title: "iasql_uninstall"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to uninstall the IaSQL modules provided by the engine

Returns following columns:
- module_name: Name of the module that was uninstalled
- dropped_table_name: Name of the associated table that was deleted
- record_count: Total of registers deleted

Accepts the following parameters:
- list of modules to uninstall

**`See`**

https://iasql.com/docs/module/

• **documentation**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `description` | `string` |
| `sample_usage` | `string` |
