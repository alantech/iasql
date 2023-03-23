---
sidebar_position: 5
slug: '/review'
---

# Peer review infrastructure changes

Engineering teams move from using cloud UIs to IaC because cloud infrastructure changes can lead to outages more often than business logic changes. As a result, it is a DevOps best practice to code review infrastructure changes using IaC tools, showing the `preview` of the resulting change in pull requests to raise the quality bar and reduce the possibility of mistakes.

The standard practice for code review of database changes is to write the changes via a [migration system](https://en.wikipedia.org/wiki/Schema_migration) such that the changes are executed after approval. We do not recommend that cloud infrastructure changes done with IaSQL follow this pattern for two reasons: first, these migration tools often do not support data changes, only schema changes, and the IaSQL schema is defined by [modules](../concepts/module.md) that can be upgraded and changed over time, and second, you lose all of the feedback the database can give you on whether or not your SQL statements are valid and what impact they will have on your cloud infrastructure.

Instead, we recommend complex, or delicate, infrastructure changes should be treated as transactions in IaSQL. [IaSQL transactions](../concepts/transaction.md) are a bit different from normal DB transactions in that they lock all database changes from propagating into the cloud but do not lock the changes from being viewed by other database connections, making them "multiuser", so others can inspect the changes, and can preview what they would do with the [`iasql_preview`](../modules/builtin/iasql_functions.md) function, similar to Pulumi’s `preview` or Terraform’s `plan`.

But, reviewable artifacts are still very useful to summarize and explain the intent behind a proposed set of changes, so we have created an easy-to-follow yet comprehensive convention to review infrastructure changes within transactions which:
- works with any cloud identity and access management structure
- works with IaSQL schema upgrades
- works with any version control system, not just GitHub, without the need for privileged access
- preserves the ability to `iasql_preview` changes in development and get the type-safety feedback from the dashboard editor

```sql title="Create review for an infrastructure change within a transaction"
-- First, we open a new transaction with `iasql_begin`
SELECT * FROM iasql_begin();
-- Then we make the infrastructure changes we need.
-- If a SQL statement is invalid, Postgres will prevent it
-- from running and it won't end up in the transaction, so
-- we can use it as our IDE.
UPDATE log_group SET log_group_name = 'test' WHERE id = 4;
-- We create the review artifact with `iasql_create_review`, providing
-- a title and a description of why we're doing this.
SELECT * FROM iasql_create_review('My infra change', 'Why this change is necessary')
```

The output of `iasql_create_review` is markdown-formatted text and will look as follows:

````
# My infra change

Why this change is necessary

## IaSQL Preview

| action | table_name | id | description |
| --- | --- | --- | --- |
| update | log_group | 4 | quickstart-log-group\|us-east-2 |

## SQL changes

```sql

UPDATE log_group
SET log_group_name = 'quickstart-log-group', log_group_arn = 'test', creation_time = '2023-01-25T11:17:14.045+00:00', region = (SELECT region FROM aws_regions WHERE region = 'us-east-2')
WHERE log_group_name = 'quickstart-log-group' AND log_group_arn = 'arn:aws:logs:us-east-2:257682470237:log-group:quickstart-log-group:*' AND creation_time = '2023-01-25T11:17:14.045+00:00' AND region = (SELECT region FROM aws_regions WHERE region = 'us-east-2');
```
````

The above string should be pasted into a markdown file within a version-controlled repository of your choosing and submitted for review by the relevant team members. Once the change has been approved and merged, come back to the transaction in the SQL REPL and simply commit it.

<!-- TODO allow passing an optional message to IaSQL commit which can be the URL of the PR -->

```sql title="Commit transaction once reviews has been accepted"
SELECT * FROM iasql_commit();
```

Finally, find below the visualization in markdown of the above string:

----

# My infra change

Why this infra change is necessary

## IaSQL Preview

| action | table_name | id | description |
| --- | --- | --- | --- |
| update | log_group | 4 | quickstart-log-group\|us-east-2 |

## SQL changes

```sql

UPDATE log_group
SET log_group_name = 'quickstart-log-group', log_group_arn = 'test', creation_time = '2023-01-25T11:17:14.045+00:00', region = (SELECT region FROM aws_regions WHERE region = 'us-east-2')
WHERE log_group_name = 'quickstart-log-group' AND log_group_arn = 'arn:aws:logs:us-east-2:257682470237:log-group:quickstart-log-group:*' AND creation_time = '2023-01-25T11:17:14.045+00:00' AND region = (SELECT region FROM aws_regions WHERE region = 'us-east-2');

```