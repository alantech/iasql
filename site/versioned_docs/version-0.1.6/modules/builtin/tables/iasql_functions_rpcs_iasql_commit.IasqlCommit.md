---
id: "iasql_functions_rpcs_iasql_commit.IasqlCommit"
title: "iasql_commit"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method that finishes a transaction. It is possible to perform changes to your cloud account synchronously by
temporarily turning off the normal two-way propagation between the cloud and database through the usage of an IaSQL
transaction using the provided PostgreSQL function `iasql_begin`. This lets you batch, or stage, changes together and
then calling `iasql_commit` to mark the end of the transaction and propagate the changes from the database to the cloud account.

**`See`**

https://iasql.com/docs/transaction

• **documentation**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `description` | `string` |
| `sample_usage` | `string` |
