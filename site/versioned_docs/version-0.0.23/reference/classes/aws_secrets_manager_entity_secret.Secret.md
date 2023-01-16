---
id: "aws_secrets_manager_entity_secret.Secret"
title: "Table: secret"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS secrets. AWS Secrets Manager helps you manage, retrieve, and rotate database credentials, API keys, and other secrets throughout their lifecycles.

A secret can be a password, a set of credentials such as a user name and password, an OAuth token, or other secret information that you store in an encrypted form in Secrets Manager.

**`Example`**

```sql TheButton[Manage a secret]="Manage a secret"
INSERT INTO secret (name, description, value) VALUES ('secret_name', 'description', 'value');
SELECT * FROM secret WHERE description='description';
DELETE FROM secret WHERE description='description';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-secret-integration.ts#L109
 - https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html

## Columns

• `Optional` **description**: `string`

Description for the secret

• **name**: `string`

Name for the secret

• **region**: `string`

Region for the secret

• `Optional` **value**: ``null`` \| `string`

Value to keep as secret

• `Optional` **version\_id**: `string`

A secret has versions which hold copies of the encrypted secret value.
When you change the secret value, or the secret is rotated, Secrets Manager creates a new version.

**`See`**

https://docs.aws.amazon.com/secretsmanager/latest/userguide/getting-started.html#term_version
