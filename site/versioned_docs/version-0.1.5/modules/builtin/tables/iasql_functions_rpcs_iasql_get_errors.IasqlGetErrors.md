---
id: "iasql_functions_rpcs_iasql_get_errors.IasqlGetErrors"
title: "iasql_get_errors"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to list the error messages produced in a transaction by `iasql_commit` or `iasql_rollback`

**`See`**

https://iasql.com/docs/transaction

Returns following columns:
- ts: Error message timestamp
- message: Error message

• **documentation**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `description` | `string` |
| `sample_usage` | `string` |
