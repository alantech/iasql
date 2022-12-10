---
sidebar_position: 3
slug: '/transaction'
---

# IaSQL transactions at a high level

Users need not use any special syntax, akin to `apply` from IaC, to work normally with IaSQL. They just `SELECT/INSERT/UPDATE/DELETE` records and eventually the changes are reflected in their cloud account. This should also work with migration systems without issues, though in an eventually-consistent fashion. The most basic architectural diagram is simply your IaSQL database and your cloud account with the IaSQL in between. 

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

## `iasql_begin` and `iasql_commit`

It is possible to perform changes to your cloud account synchronously by temporarily turning off the normal two-way propagation between the cloud and database through the usage of an IaSQL transaction using the provided PostgreSQL function `iasql_begin`. This lets the user make whatever changes they want to batch together or stage, and then calling `iasql_commit` marks the end of the transaction and propagates the changes from the database to the cloud account akin to a traditional [database transaction](https://en.wikipedia.org/wiki/Database_transaction).

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

Users can visualize proposed changes for an ongoing IaSQL transaction to see how the database will update the cloud with the new data model using the `iasql_preview` function which returns a virtual table of database records.

## `iasql_rollback`

Users abort an IaSQL transaction if they want to discard the changes the have been working since calling `iasql_begin` by calling `iasql_rollback`. This will re-enable regular behaviour of IaSQL in which changes are propagated both ways in an eventually consistent way without any special syntax other than `SELECT/INSERT/UPDATE/DELETE` records normally.

```
   ______
  /      \       _______            __
  |\____/|      |       |       ___/  \__
  |  DB  | <=== | IaSQL | <=== /  Cloud  \
  |      |      |_______|      \_    _   /
  \______/                       \__/ \_/
```