---
sidebar_position: 1
slug: '/'
---

# Getting Started

[IaSQL](https://iasql.com) is open-source software to manage cloud infrastructure using an unmodified PostgreSQL database by maintaining a 2-way connection between a database and your AWS account. The rows in the database tables represent the infrastructure in your cloud account. The database is automatically backfilled with all your existing cloud resources. Which tables are loaded into an [IaSQL database](./concepts/db.md) is configured based on what [IaSQL modules](./concepts/module.md) are installed in a db. Every IaSQL module represents a cloud service like `aws_ec2` or `aws_elb`. Once the desired modules are installed with the `install` [IaSQL PostgreSQL function](./aws/modules/iasql_functions.md), run `INSERT` or `UPDATE` queries on the database by using the PG connection string displayed when you first set up in the dashboard with your preferred [PostgreSQL client](./how-to/connect.md). Finally, IaSQL will push the changes in your database to the cloud. To run IaSQL locally run:

```bash
docker run -p 5432:5432 -p 8888:8888 --name iasql iasql/iasql
```

There is also a [/hosted](/hosted) version of IaSQL that provisions a PostgreSQL database for you and configures it to manage an AWS account and region.

## What part of the documentation should I look at?

A high-level overview of how the IaSQL documentation is organized will help you know how to quickly find what you are looking for:

- The [tutorials](/blog/tags/tutorial/) will guide you from 0 to an HTTP server to your AWS account using ECS, ECR, RDS and ELB using IaSQL. Start here if you’re new to IaSQL.
- [How-to guides](./how-to/connect.md) are recipes. They guide you through the steps involved in addressing key problems and use-cases. They are more advanced than the quickstart and assume some knowledge of how IaSQL works.
- [Concepts](./concepts/db.md) provides useful background and describes at a fairly high level the internals of how IaSQL works.
- Technical [reference](./aws/) for built-in APIs. They describe how it works and how to use it but assume some knowledge of how IaSQL works.
