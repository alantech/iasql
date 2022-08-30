---
sidebar_position: 1
slug: '/database'
---

# Database

An IaSQL Database feels a lot like a Postgres database. Because that is what it is: a 100% standard Postgres database with zero extensions, and anything you can do with a Postgres database you can do with an IaSQL database.

But it is administered a bit differently from a standard Postgres database. The IaSQL engine mediates between the database and your cloud infrastructure, so the database has been configured with a few affordances for that engine in mind.

The first piece you may note are a pair of tables: `iasql_module` and `iasql_dependencies`. These tables represent the [modules](./module.md) you have installed and what dependencies, if any, they require. You may have also noted that these tables are read-only for your account and you cannot manipulate their contents. You can think of them as a non-linear migration system and the IaSQL engine installs or uninstalls these modules based on your requests to it via the [IaSQL PostgreSQL functions](../reference/function.md). You can use a standard migration system in tandem with this system, for tracking the state of your infrastructure and allowing for easy rollback, but instead of managing the schema you're managing the data in the tables.

There's nothing stopping you from adding your own custom tables, such as adding your own metadata tables to associate with your infrastructure, but the IaSQL engine will ignore them at best, and get tripped up if a foreign key prevents a deletion it expects to be able to do.

Because the next thing that is a bit different from a normal Postgres database is the IaSQL engine can mutate your database state outside of your own connection to it. When you run `SELECT * FROM iasql_apply()` it takes the current state of your database and pushes it into your cloud infrastructure, but for both convenience and to resolve dependency issues in other modules, that `apply` can still update columns in your database with new data. For instance, creating a new EC2 instance will cause it to then insert the AWS-controlled `instance_id` into the database automatically for you. These changes to your database only happen when you run the IaSQL PosgreSQL functions to do something to it, but making mutations to the database on your side while it is doing its work could cause errors. Fortunately such a workflow is unlikely.

You can also provide the same AWS credentials to two hosted IaSQL databases, but that will cause issues outside of one being treated as read-write and the other as read-only: the two sources of truth for your infrastructure would clash and undo each others' work when you run `SELECT * FROM iasql_apply()` on them and that might not be immediately obvious. Having one database indirectly change the values for another database (on `apply/sync`) is different from your regular database usage.