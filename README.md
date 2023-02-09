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

[IaSQL](https://iasql.com) is open-source software that treats infrastructure as data by maintaining a 2-way connection between a cloud account and a PostgreSQL database.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./site/static/img/ec2-typewriter_dark.gif">
  <source media="(prefers-color-scheme: light)" srcset="/site/static/img/ec2-typewriter.gif">
  <img width="700"/>
</picture>

## ⚡️ Try out IaSQL

To connect your AWS account to a PostgreSQL database running locally make sure docker is installed and run:

```bash
docker run -p 5432:5432 -p 8888:8888 --name iasql iasql/iasql
```

Alternatively, use a hosted version of IaSQL at [app.iasql.com](https://app.iasql.com)

## 💬 Community, Support and Questions

Reach out on Discord to:

- Get help with errors you encounter using IaSQL
- Ask about general problems with databases or infrastructure
- Discuss database and infrastructure best practices
- Share what you built

<a href="https://discord.com/invite/machGGczea">
  <img src="https://discord.com/assets/ff41b628a47ef3141164bfedb04fb220.png" height="40px" />
</a>

## 📄 Documentation

For full documentation, visit [iasql.com/docs](https://iasql.com/docs)

## 🚀 Contribute

To contribute, visit [Contributing.md](https://github.com/reference/sql.md/blob/main/CONTRIBUTING.md)

## ☁️ Cloud Providers

AWS is our main focus at the moment, but we plan to support GCP, Azure and other cloud providers soon. Let us know if you need a specific AWS service and we might be able to prioritize it!

### AWS services with significant API coverage

- CloudWatch
- [EC2](https://iasql.com/docs/aws_ec2)
- [ECR](https://iasql.com/docs/aws_ecr/)
- [ECS + Fargate](https://iasql.com/docs/fargate/)
- ELB
- [IAM](https://iasql.com/docs/aws_iam/)
- Lambda
- [RDS](https://iasql.com/docs/aws_rds/)
- S3
- [Security Groups](https://iasql.com/docs/aws_security_group/)
- [VPC](https://iasql.com/docs/vpc/)

### AWS services with basic API coverage

- API Gateway
- AppSync
- CloudFront
- Dynamo DB
- ElastiCache
- MemoryDB
- [Route53](https://iasql.com/docs/aws_route53/)
- Secrets Manager
- SNS

Check out AWS services that are going to be added next [here](https://github.com/iasql/iasql/issues?q=is%3Aissue+is%3Aopen+label%3A%22cloud+coverage%22) and let us know if you would like to see one that is not listed!
