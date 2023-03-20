---
sidebar_position: 4
slug: '/envs'
---

# Replicate changes across infra environments

One of the value propositions of IaSQL is that you get type safety and validation via foreign key relations. However, that also means that no two IaSQL databases will be the same. Due to foreign keys and cloud infrastructure differences across environments (dev, staging, prod, etc) in capacity and geography, we recommend that IaSQL users have one AWS account per environment so you aren't surprised that, for example, an EC2 instance type you used for a VM in staging is not available in the production availability zone. Then each AWS account should be [connected](./aws.mdx) to an [IaSQL database](../concepts/db.md) that is modified independently. This guide will take you through how to make changes to an IaSQL database connected to your staging environment called `mycompanydb-staging` and then replicate those changes in your production environment using a *different* IaSQL database called `mycompanydb-prod`.

Complex, or delicate, infrastructure changes should be treated as transactions. [IaSQL transactions](../concepts/transaction.md) are a bit different from normal DB transactions in that they are multiuser and can be previewed with the [`iasql_preview`](../modules/builtin/iasql_functions.md) function for the changes that the ongoing transaction would create in the cloud, similar to Pulumi’s `preview` or Terraform’s `plan`.

```sql title="mycompanydb-staging"
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

Once the transaction is committed successfully and the desired changes are reflected in your staging AWS account, how do you easily replicate the analog of these changes in production? You can use another IaSQL function that looks at the IaSQL audit log and generates the SQL needed to represent changes done by a given transaction in `mycompany-staging`.

<!-- TODO if no transaction is provided, default to current or latest -->

```sql title="mycompanydb-staging"
-- gets SQL from the audit log for the previous transaction
SELECT *
  FROM iasql_get_sql_for_transaction(
    (
      SELECT transaction_id
      FROM iasql_audit_log
      ORDER BY ts DESC
      LIMIT 1
    )
  );
```

Finally once everything looks good in staging, copy the SQL queries generated from invoking the `iasql_get_sql_since` in `mycompanydb-staging` as a starting point for the SQL you will run in `mycompanydb-prod`. Now `iasql_begin` a transaction in `mycompanydb-prod`, make any changes to the generated SQL if necessary, and `iasql_commit`. It is common for foreign keys, resource types, firewall settings, DNS records, etc to be different across environments.

```sql title="mycompanydb-prod"
--- starts a transaction
SELECT * FROM iasql_begin();

--- infrastructure changes

--- calls iasql_preview to see what would be the result in the cloud account
select * from iasql_preview();

--- calls iasql_commit and make the resulting changes in the cloud account
select * from iasql_commit();
```

:::note
We do not recommend using database migrations systems to try to version control changes as outlined by this [RFC](https://github.com/iasql/iasql/blob/main/rfcs/006%20-%20Replicate%20changes%20between%20staging%20and%20prod%20RFC.md). Version control + peer review of IaSQL infrastructure transactions without using migration systems is part of our roadmap. If you are interested let us know on [Discord](https://discord.iasql.com) so we can better understand your use case and solve for it.
:::