---
id: "iasql_functions_rpcs_iasql_get_errors.IasqlGetErrors"
title: "iasql_get_errors"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to list the error messages produced in a transaction by `iasql_commit` or `iasql_rollback`

**`See`**

https://iasql.com/docs/transaction

Returns following columns:
- ts: Error message timestamp
- message: Error message
