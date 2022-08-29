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

Create a private repository and `apply` it. View the `repository` table schema [here](https://dbdocs.io/iasql/iasql?table=repository&schema=public&view=table_structure). 

```sql
INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability)
VALUES ('iasqlsample', false, 'MUTABLE');

SELECT * FROM iasql_apply();
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/INSERT%20INTO%20repository%20%28repository_name%2C%20scan_on_push%2C%20image_tag_mutability%29%0AVALUES%20%28%27iasqlsample%27%2C%20false%2C%20%27MUTABLE%27%29%3B%0A%0ASELECT%20%2A%20FROM%20iasql_apply%28%29%3B', '_blank')}
>
Run SQL
</button>

## Create a public repository

Create a public repository and `apply` it. View the `public_repository` table schema [here](https://dbdocs.io/iasql/iasql?table=public_repository&schema=public&view=table_structure)

```sql
INSERT INTO public_repository (repository_name)
VALUES ('iasqlsample');

SELECT * FROM iasql_apply();
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/INSERT%20INTO%20public_repository%20%28repository_name%29%0AVALUES%20%28%27iasqlsample%27%29%3B%0A%0ASELECT%20%2A%20FROM%20iasql_apply%28%29%3B', '_blank')}
>
Run SQL
</button>