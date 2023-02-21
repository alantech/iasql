---
sidebar_position: 3
slug: '/error'
---

# Inspecting cloud errors

IaSQL asynchronously applies the infrastructure as described in your database to your cloud account unless you are using an [IaSQL transaction](../concepts/transaction.md). Sometimes you might run a SQL query with a typo that doesn't throw a PostgreSQL schema error, but the AWS SDK throws an error. For context, just [the AWS EC2 SDK has over a hundred possible errors](https://docs.aws.amazon.com/AWSEC2/latest/APIReference/errors-overview.html). In these cases, it is important to be able to inspect the cloud errors. We provide the following PostgreSQL function which will return a sorted list of errors starting with the most recent:

```sql
SELECT * FROM iasql_get_errors();
```

Errors might take a few minutes to show up based on the timings from the AWS SDK which. The query result will provide the necessary information for you to change the state of your infrastructure to something more amenable to AWS. 