<div align="center">
  <img src="https://iasql.com/lib_TQbMwqDvYvWhOqVJ/qp6b8vokhnkse82a.png" alt="drawing" width="180"/>
</div>

[![CI](https://github.com/alantech/alan/workflows/CI/badge.svg)](https://github.com/iasql/iasql-engine/actions?query=workflow%3ACI)
[![Docs](https://img.shields.io/badge/docs-docusaurus-blue)](https://docs.iasql.com)
[![Discord](https://img.shields.io/badge/discord-iasql-purple)](https://discord.com/invite/machGGczea)
[![Reddit](https://img.shields.io/badge/reddit-iasql-red)](https://www.reddit.com/r/iasql)
[![Twitter](https://img.shields.io/badge/twitter-iasql-9cf)](https://www.twitter.com/iasql)

---

# Infrastructure as a SQL DB

[IaSQL](https://iasql.com) lets you model your infrastructure as data by maintaining a 2-way connection between your AWS account and a Postgres SQL database.

## Documentation

For full documentation, visit [docs.iasql.com](https://docs.iasql.com)

## Local Development

This repo houses IaSQL engine which is called by the [cli](https://github.com/iasql/cli). Set your `.env` file based on the values from `src/config.ts`, make sure docker is installed locally and bring up the postgres engine and node.js server by running

```
docker-compose up --build
```