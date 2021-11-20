---
sidebar_position: 1
slug: '/'
---

# Getting started

[IaSQL](https://iasql.com) is SaaS to manage AWS infrastructure via a [CLI](/install) that provisions a Postgres database loaded with tables representing AWS services in your AWS account/IAM. Which tables are loaded into an [IaSQL database](/database) is configured based on what [modules](/module) are installed. Once modules are installed, simply connect to the database with the PG connection string using your preferred ORM or driver, run `INSERT` or `UPDATE` queries, and finally run the `apply` CLI command to provision infrastructure.

## What part of the documentation should I look at?

A high-level overview of how the IaSQL documentation is organized will help you know how to quickly find what you are looking for:

* The [quickstart](/quickstart) will guide you from 0 to a sample Node.js HTTP server deployed in your AWS account with IaSQL. Start here if you’re new to IaSQL.
* [How-to guides](/how-to-guides) are recipes. They guide you through the steps involved in addressing key problems and use-cases. They are more advanced than the quickstart and assume some knowledge of how IaSQL works.
* [Concepts](/concepts) provides useful background and describes at a fairly high level the internals of how IaSQL works.
* Technical [reference](/reference) for built-in APIs and JSON file configuration schemas. They describe how it works and how to use it but assume some knowledge of how AnyCloud works