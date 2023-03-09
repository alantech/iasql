---
sidebar_position: 4
slug: '/envs'
---

# Replicate changes across infra environments

Due to capacity, region, and other differences across cloud infrastructure environments, we recommend that IaSQL users have one AWS account per environment (dev, staging, prod, etc) so you aren't surprised that, for example, an EC2 instance type you used in staging is not available in production. Then each AWS account should be [connected](./aws.mdx) to an [IaSQL database](../concepts/db.md) that is modified independently.

Complex, or delicate, infrastructure changes should be treated as transactions. [IaSQL transactions](../concepts/transaction.md) are a bit different from normal DB transactions in that they are multiuser and can be previewed with the [`iasql_preview`](../modules/builtin/iasql_functions.md) function for the changes that the ongoing transaction will create in the cloud, similar to Pulumi’s `preview` or Terraform’s `plan`.

```sql
--- starts a transaction
SELECT * FROM iasql_begin();

--- infrastructure changes

--- calls iasql_preview to see what would be the result in the cloud account
select * from iasql_preview();

--- more infrastructure changes

--- calls iasql_preview to see what would be the result in the cloud account
select * from iasql_preview();

--- calls iasql_commit and make the resulting changes in the cloud account
select * from iasql_commit();
```

Once the transaction is committed successfully and the desired changes are committed into the DB for that environment, you can use another IaSQL function that looks at the audit log and generates the SQL needed to represent changes done from a given point in time.

```sql
-- gets SQL from the audit log from a given point in time
SELECT * FROM iasql_get_sql_since((now() - interval '2 hours')::text);
```

Copy the SQL queries generated from invoking the function in the first database as a starting point for the SQL you will run in the second DB / environment, make any changes to the SQL if needed and include it within a new transaction in the second database. We do not recommend using database migrations systems to try to version control changes as outlined by this [RFC](https://github.com/iasql/iasql/blob/main/rfcs/006%20-%20Replicate%20changes%20between%20staging%20and%20prod%20RFC.md). One of the value propositions of IaSQL is that you get type safety and validation via FKs. However, these are different in each DB / environment. If you wish to version control or peer review infrastructure transactions, there is a Github Module in our roadmap that automatically puts up the SQL generated from the ongoing transaction and the preview output in a markdown file within a PR that others can approve. Let us know on [Discord](https://discord.iasql.com) and we can prioritize it.