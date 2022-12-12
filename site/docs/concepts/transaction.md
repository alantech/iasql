---
sidebar_position: 3
slug: '/transaction'
---

# IaSQL transactions at a high level

IaSQL does not any special syntax, akin to `apply` in IaC, to work normally. You can just `SELECT/INSERT/UPDATE/DELETE` records and eventually the changes are reflected in your cloud account. This also works with migration systems without issues, though in an eventually-consistent fashion. The most basic architectural diagram is simply your IaSQL database and your cloud account with the IaSQL in between.

```
   ______
  /      \       _______            __
  |\____/|      |       |       ___/  \__
  |  DB  | <==> | IaSQL | <==> /  Cloud  \
  |      |      |_______|      \_    _   /
  \______/                       \__/ \_/
```

In both directions, though, the engine needs to be aware of what already exists on the other side in order to make only the calls necessary to produce the desired mutation on the other side.

Traditional IaC tools like Terraform use an internal statefile for this purpose, but this is folly. If there is ever an unexpected change, such as from an outage (or the manual mitigation of an outage) this statefile will not represent the other side correctly so the mutations it attempts will be incorrect causing the change to fail.

IaSQL's engine, on the other hand, is completely stateless. It acquires the state of both the database and the cloud when asked to perform a change in either direction and then determines the work it will do based on the *true state* of both.

## IaSQL Transactions with `iasql_begin` and `iasql_commit`

It is possible to perform changes to your cloud account synchronously by temporarily turning off the normal two-way propagation between the cloud and database through the usage of an IaSQL transaction using the provided PostgreSQL function `iasql_begin`. This lets you batch, or stage, changes together and then calling `iasql_commit` to mark the end of the transaction and propagate the changes from the database to the cloud account akin to a traditional [database transaction](https://en.wikipedia.org/wiki/Database_transaction).

```
   ______
  /      \       _______            __
  |\____/|      |       |       ___/  \__
  |  DB  | ===> | IaSQL | ===> /  Cloud  \
  |      |      |_______|      \_    _   /
  \______/                       \__/ \_/
```

The way this works under the hood is that IaSQL has a cron job that makes sure to keep the two way synchronization between the database and the cloud that is paused while an IaSQL transaction is in progress.

## `iasql_preview`

IaSQL lets you visualize proposed changes for an ongoing IaSQL transaction to see how the database will update the cloud with the new data model using the `iasql_preview` function which returns a virtual table of database records.

## `iasql_rollback`

IaSQL lets you abort an IaSQL transaction if you want to discard the changes done since calling `iasql_begin` by calling `iasql_rollback`. This will re-enable regular behaviour of IaSQL in which changes are propagated both ways in an eventually consistent way without any special syntax other than `SELECT/INSERT/UPDATE/DELETE` records normally.

```
   ______
  /      \       _______            __
  |\____/|      |       |       ___/  \__
  |  DB  | <=== | IaSQL | <=== /  Cloud  \
  |      |      |_______|      \_    _   /
  \______/                       \__/ \_/
```