---
id: "aws_secrets_manager_entity_secret.Secret"
title: "secret"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS secrets. AWS Secrets Manager helps you manage, retrieve, and rotate database credentials, API keys, and other secrets throughout their lifecycles.

A secret can be a password, a set of credentials such as a user name and password, an OAuth token, or other secret information that you store in an encrypted form in Secrets Manager.

**`See`**

https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html

## Columns

• `Optional` **description**: `string`

Description for the secret

• **name**: `string`

Name for the secret

• **region**: `string`

Region for the secret

• `Optional` **value**: `null` \| `string`

Value to keep as secret

• `Optional` **version\_id**: `string`

A secret has versions which hold copies of the encrypted secret value.
When you change the secret value, or the secret is rotated, Secrets Manager creates a new version.

**`See`**

https://docs.aws.amazon.com/secretsmanager/latest/userguide/getting-started.html#term_version
