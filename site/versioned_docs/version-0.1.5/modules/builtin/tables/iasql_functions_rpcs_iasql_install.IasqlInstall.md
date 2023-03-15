---
id: "iasql_functions_rpcs_iasql_install.IasqlInstall"
title: "iasql_install"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to install the IaSQL modules provided by the engine

Returns following columns:
- module_name: Name of the module that was installed
- created_table_name: Name of the associated table that was created
- record_count: Total of registers added

Accepts the following parameters:
- list of modules to install

**`See`**

https://iasql.com/docs/module/

• **documentation**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `description` | `string` |
| `sample_usage` | `string` |
