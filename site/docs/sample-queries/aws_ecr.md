---
sidebar_position: 6
slug: '/aws_ecr'
---

# AWS Elastic Container Registry

Install the AWS ECR module. Read more about AWS ECR repositories [here](https://docs.aws.amazon.com/AmazonECR/latest/userguide/Repositories.html#repository-concepts).

```sql
SELECT * FROM iasql_install('aws_ecr');
```

## Create a private repository

Create a private repository and apply it to the cloud. View the `repository` table schema [here](https://dbdocs.io/iasql/iasql?table=repository&schema=public&view=table_structure). 

```sql TheButton
INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
VALUES ('iasqlsample', false, 'MUTABLE');
```

## Create a public repository

Create a public repository and push that change to the cloud. View the `public_repository` table schema [here](https://dbdocs.io/iasql/iasql?table=public_repository&schema=public&view=table_structure)

```sql TheButton
INSERT INTO public_repository (repository_name)
VALUES ('iasqlsample');
```
