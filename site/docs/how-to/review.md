---
sidebar_position: 5
slug: '/review'
---

# Peer review infrastructure changes

Eng teams move over from using cloud UIs to IaC because cloud infrastructure changes can lead to outages more often than business logic changes. As a result, it is considered a DevOps best practice to code review infrastructure changes using IaC tools and show the `preview` of the resulting change in pull requests to raise the quality bar and reduce the possibility of mistakes. We do not recommend that cloud infrastructure changes done with IaSQL be code-reviewed using migration systems since the IaSQL schema is defined by [modules](../concepts/module.md) that can be upgraded and changed over time. Furthermore, we recommend complex, or delicate, infrastructure changes should be treated as transactions in IaSQL. [IaSQL transactions](../concepts/transaction.md) are a bit different from normal DB transactions in that they are multiuser and can be previewed with the [`iasql_preview`](../modules/builtin/iasql_functions.md) function for the changes that the ongoing transaction would create in the cloud, similar to Pulumi’s `preview` or Terraform’s `plan`.

We set forth the best convention to review infrastructure changes within transactions which:
- works with any cloud identity and access management structure
- works with IaSQL schema upgrades
- works with any version control system, not just GitHub, without the need for privileged access
- preserves the ability to `iasql_preview` changes in development and get the type-safety feedback from the dashboard editor

```sql title="Create review for an infrastructure change within a transaction"
SELECT * FROM iasql_begin();

UPDATE log_group SET log_group_arn = 'test' WHERE log_group_name = 'quickstart-log-group';

SELECT * FROM iasql_create_review('My review')
```

The raw markdown content returned will look as follows:

```
# My review

Review description

## IaSQL Preview

| action | table_name | id | description |
| --- | --- | --- | --- |
| update | log_group | 4 | quickstart-log-group|us-east-2 |

## SQL changes

```sql

UPDATE log_group
SET log_group_name = 'quickstart-log-group', log_group_arn = 'test', creation_time = '2023-01-25T11:17:14.045+00:00', region = (SELECT region FROM aws_regions WHERE region = 'us-east-2')
WHERE log_group_name = 'quickstart-log-group' AND log_group_arn = 'arn:aws:logs:us-east-2:257682470237:log-group:quickstart-log-group:*' AND creation_time = '2023-01-25T11:17:14.045+00:00' AND region = (SELECT region FROM aws_regions WHERE region = 'us-east-2');

```

The above string should be pasted into a markdown file within a version-controlled repository of your choosing and submitted for review by the relevant team members. Once the change has been approved and merged, come back to the transaction in the SQL REPL and simply commit it.

<!-- TODO allow passing an optional message to IaSQL commit which can be the URL of the PR -->

```sql title="Commit transaction once reviews has been accepted"
SELECT * FROM iasql_commit();
```

Below is the visualization in markdown of the above string:


----


# Change log group name

Review description

## IaSQL Preview

| action | table_name | id | description |
| --- | --- | --- | --- |
| update | log_group | 4 | quickstart-log-group | us-east-2 |

## SQL changes

```sql

UPDATE log_group
SET log_group_name = 'quickstart-log-group', log_group_arn = 'test', creation_time = '2023-01-25T11:17:14.045+00:00', region = (SELECT region FROM aws_regions WHERE region = 'us-east-2')
WHERE log_group_name = 'quickstart-log-group' AND log_group_arn = 'arn:aws:logs:us-east-2:257682470237:log-group:quickstart-log-group:*' AND creation_time = '2023-01-25T11:17:14.045+00:00' AND region = (SELECT region FROM aws_regions WHERE region = 'us-east-2');

```