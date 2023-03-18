<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/static/img/logo_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="/site/static/img/logo.png">
    <img width="180"/>
  </picture>
</p>

&nbsp;

[![Integration Tests](https://github.com/iasql/iasql/actions/workflows/tests.yml/badge.svg)](https://github.com/iasql/iasql/actions/workflows/tests.yml)
[![Dashboard Tests](https://github.com/iasql/iasql/actions/workflows/tests-dashboard.yml/badge.svg)](https://github.com/iasql/iasql/actions/workflows/tests-dashboard.yml)
[![Docs](https://img.shields.io/badge/docs-docusaurus-blue)](https://iasql.com/docs)
[![Discord](https://img.shields.io/badge/discord-iasql-purple)](https://discord.com/invite/machGGczea)
[![Twitter](https://img.shields.io/badge/twitter-iasql-9cf)](https://www.twitter.com/iasql)

---

# Cloud infrastructure as data in PostgreSQL

[IaSQL](https://iasql.com) is open-source software to inspect and provision cloud infrastructure via SQL by maintaining a 2-way connection between an unmodified PostgreSQL database and your AWS account. The rows in the database tables represent the infrastructure in your cloud account.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./site/static/img/ec2-typewriter_dark.gif">
  <source media="(prefers-color-scheme: light)" srcset="/site/static/img/ec2-typewriter.gif">
  <img width="700"/>
</picture>

## ⚡️ Try out IaSQL

To get started with IaSQL our documentation. Visit [iasql.com/docs](https://iasql.com/docs)

## 💬 Community, Support, and Questions

Reach out on Discord

<a href="https://discord.com/invite/machGGczea">
  <img src="https://discord.com/assets/ff41b628a47ef3141164bfedb04fb220.png" height="40px" />
</a>

## 🔨 Use cases

- [Quickly setup ECR+ECS+ELB using our ejectable abstraction for those services](https://iasql.com/blog/ecs-simplified)
- [Save on AWS by deleting untagged ECR images](https://iasql.com/blog/ecr-save)
- [Deploy a static website](https://iasql.com/blog/deploy-static-website)
- [Save $ on public S3 buckets using VPC endpoints via SQL](https://iasql.com/blog/save-s3-vpc)
- [Securely connect to an Amazon RDS via PrivateLink](https://iasql.com/blog/rds-privatelink)

## ☁️ Cloud Providers

AWS is our main focus at the moment, but we plan to support GCP, Azure and other cloud providers soon. Let us know if you need a specific AWS service and we might be able to prioritize it!

### AWS coverage

An IaSQL module roughly maps to an AWS service. Check out our supported modules in this [part](https://iasql.com/docs/modules/) of our docs. 

AWS services that are going to be added next can be found [here](https://github.com/iasql/iasql/issues?q=is%3Aissue+is%3Aopen+label%3A%22cloud+coverage%22). Let us know if you would like to see one that is not listed!

## 🚀 Contribute

To contribute, visit [Contributing.md](https://github.com/iasql/iasql/blob/main/CONTRIBUTING.md)
