---
id: "iasql_functions_rpcs_iasql_commit.IasqlCommit"
title: "Method: iasql_commit"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method that finishes a transaction. It is possible to perform changes to your cloud account synchronously by
temporarily turning off the normal two-way propagation between the cloud and database through the usage of an IaSQL
transaction using the provided PostgreSQL function `iasql_begin`. This lets you batch, or stage, changes together and
then calling `iasql_commit` to mark the end of the transaction and propagate the changes from the database to the cloud account.

**`See`**

https://iasql.com/docs/transaction

**`Example`**

```sql
SELECT * FROM iasql_begin();
```

## Columns
