# IaSQL

<h2 align="center">
Infrastructure as SQL
</h2>

This is where the main IaSQL engine is located

### Local Development

Set your .env file based on the values from `src/config.ts`, make sure docker is installed locally and then run

```
docker-compose up --build
```

which will bring up the postgres engine and node.js server.