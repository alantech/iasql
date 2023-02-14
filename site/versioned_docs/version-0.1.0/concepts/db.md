---
sidebar_position: 1
slug: '/database'
---

# Database

An IaSQL Database feels a lot like a Postgres database. Because that is what it is: a 100% standard Postgres database with zero extensions, and anything you can do with a Postgres database you can do with an IaSQL database.

But it is administered a bit differently from a standard Postgres database. IaSQL mediates between the database and your cloud infrastructure, so the database has been configured with a few affordances for IaSQL in mind.

The first piece you may note are a pair of tables: `iasql_module` and `iasql_dependencies`. These tables represent the [modules](./module.md) you have installed and what dependencies, if any, they require. You may have also noted that these tables are read-only for your account and you cannot manipulate their contents. You can think of them as a non-linear migration system and IaSQL installs or uninstalls these modules based on your requests to it via the [IaSQL PostgreSQL functions](../modules/builtin/iasql_functions.md). You can use a standard migration system in tandem with this system, for tracking the state of your infrastructure and allowing for easy rollback, but instead of managing the schema you're managing the data in the tables.

There's nothing stopping you from adding your own custom tables, such as adding your own metadata tables to associate with your infrastructure, but IaSQL will ignore them at best, and get tripped up if a foreign key prevents a deletion it expects to be able to do.

IaSQL can change resources in your cloud account based on what you created with `INSERT/UPDATE/DELETE` statements in your database. However, the next thing that is different from a normal Postgres database is that IaSQL can mutate your database state outside of your own connection to it. IaSQL periodically propagates the changes between your database and your cloud infrastructure and so for both convenience and to resolve dependency issues in other modules IaSQL will update columns in your database with new data. For instance, creating a new EC2 instance will cause it to then insert the AWS-controlled `instance_id` into the database automatically for you. Similarly, creating a new EC2 instance through the AWS console will eventually be picked by IaSQL and reflected in the database as a completely new record.

You can also provide the same AWS credentials to two IaSQL databases, but that will cause issues outside of one being treated as read-write and the other as read-only: the two sources of truth for your infrastructure would clash and undo each others' work when you run `SELECT * FROM iasql_commit()` on them and that might not be immediately obvious. Having one database indirectly change the values for another database (on an IaSQL [`transaction`](./transaction.md)) is different from your regular database usage.
