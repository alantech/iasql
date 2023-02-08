---
id: "iasql_functions_rpcs_iasql_preview.IasqlPreview"
title: "iasql_preview"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to visualize proposed changes for an ongoing IaSQL transaction to see how the database will update
the cloud with the new data model using the `iasql_preview` function which returns a virtual table of database records.

Returns following columns:
- action: The action issued in the db
- table_name: Table that was affected
- id: the ID of the generated change
- description: A description of the generated change

**`See`**

https://iasql.com/docs/transaction/
