---
sidebar_position: 1
slug: '/'
---

# Getting Started

[IaSQL](https://iasql.com) is a SaaS to manage cloud infrastructure as relational data and infrastructure changes as SQL. Our [CLI](/install) provisions a Postgres database and you can then add tables representing cloud services, or modules. The rows in the tables represent the infrastructure in your cloud account. Which tables are loaded into an [IaSQL database](/database) is configured based on what [IaSQL modules](/module) are installed in a db. Every IaSQL module represents a cloud service like `aws_ec2` or `aws_elb`. Once the desired modules are installed, simply connect to the database with the PG connection string displayed on `iasql new` using your preferred way to [connect](/connect) to Postgres, run `INSERT` or `UPDATE` queries, and finally run the `apply` CLI command to provision infrastructure in your cloud account.

## What part of the documentation should I look at?

A high-level overview of how the IaSQL documentation is organized will help you know how to quickly find what you are looking for:

* The [quickstart](/quickstart) will guide you from 0 to an HTTP server and database deployed via IaSQL to your AWS account using ECS, ECR, RDS and ELB. Start here if you’re new to IaSQL.
* [How-to guides](/import) are recipes. They guide you through the steps involved in addressing key problems and use-cases. They are more advanced than the quickstart and assume some knowledge of how IaSQL works.
* [Concepts](/database) provides useful background and describes at a fairly high level the internals of how IaSQL works.
* Technical [reference](/cli) for built-in APIs. They describe how it works and how to use it but assume some knowledge of how IaSQL works.