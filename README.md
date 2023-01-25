<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/static/img/logo_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="/site/static/img/logo.png">
    <img width="180"/>
  </picture>
</p>

&nbsp;

[![CI Tests](https://github.com/iasql/iasql-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/iasql/iasql-engine/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-docusaurus-blue)](https://iasql.com/docs)
[![Discord](https://img.shields.io/badge/discord-iasql-purple)](https://discord.com/invite/machGGczea)
[![Twitter](https://img.shields.io/badge/twitter-iasql-9cf)](https://www.twitter.com/iasql)

---

# Cloud infrastructure as data in PostgreSQL

[IaSQL](https://iasql.com) is an open-source SaaS that treats infrastructure as data by maintaining a 2-way connection between a cloud account and a PostgreSQL database.

## ⚡️ Try out IaSQL

<a href="https://app.iasql.com#/button/SELECT%20%2A%20FROM%20iasql_install%28%27aws_ec2%27%29%3B%0A%0AINSERT%20INTO%20instance%20%28ami%2C%20instance_type%2C%20tags%29%0A%20%20VALUES%20%28%27resolve%3Assm%3A%2Faws%2Fservice%2Fcanonical%2Fubuntu%2Fserver%2F20.04%2Fstable%2Fcurrent%2Famd64%2Fhvm%2Febs-gp2%2Fami-id%27%2C%20%27t2.micro%27%2C%20%27%7B%22name%22%3A%22i-1%22%7D%27%29%3B%0A%0AINSERT%20INTO%20instance_security_groups%20%28instance_id%2C%20security_group_id%29%20SELECT%0A%20%20%28SELECT%20id%20FROM%20instance%20WHERE%20tags%20-%3E%3E%20%27name%27%20%3D%20%27i-1%27%29%2C%0A%20%20%28SELECT%20id%20FROM%20security_group%20WHERE%20group_name%3D%27default%27%20AND%20vpc_id%20%3D%20%28SELECT%20id%20FROM%20vpc%20WHERE%20is_default%20%3D%20true%20AND%20region%3Ddefault_aws_region%28%29%29%29%3B">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./site/static/img/ec2-typewriter_dark.gif">
    <source media="(prefers-color-scheme: light)" srcset="/site/static/img/ec2-typewriter.gif">
    <img width="700"/>
  </picture>
</a>

Use the dashboard to connect a hosted PostgreSQL database to an AWS account. Visit [app.iasql.com](https://app.iasql.com)

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

To contribute, visit [Contributing.md](https://github.com/iasql/iasql-engine/blob/main/CONTRIBUTING.md)

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

Check out AWS services that are going to be added next [here](https://github.com/iasql/iasql-engine/issues?q=is%3Aissue+is%3Aopen+label%3A%22cloud+coverage%22) and let us know if you would like to see one that is not listed!
