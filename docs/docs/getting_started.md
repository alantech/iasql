---
sidebar_position: 1
slug: '/'
---

# Getting Started

[IaSQL](https://iasql.com) is a SaaS to manage infrastructure as SQL via a [CLI](/before/#install-cli) that provisions a Postgres database loaded with tables representing cloud services. The rows in the tables represent the infrastructure in your cloud account. Which tables are loaded into an [IaSQL database](/database) is configured based on what [IaSQL modules](/module) are installed in the db. Once the desired modules are installed, simply connect to the database with the PG connection string using your preferred method, run `INSERT` or `UPDATE` queries, and finally run the `apply` CLI command to provision infrastructure in your cloud account.

## What part of the documentation should I look at?

A high-level overview of how the IaSQL documentation is organized will help you know how to quickly find what you are looking for:

* The [quickstart](/quickstart) will guide you from 0 to a sample Node.js HTTP server deployed in your AWS account with IaSQL. Start here if you’re new to IaSQL.
* [How-to guides](/how-to-guides) are recipes. They guide you through the steps involved in addressing key problems and use-cases. They are more advanced than the quickstart and assume some knowledge of how IaSQL works.
* [Concepts](/concepts) provides useful background and describes at a fairly high level the internals of how IaSQL works.
* Technical [reference](/reference) for built-in APIs. They describe how it works and how to use it but assume some knowledge of how IaSQL works.