---
id: "aws_codebuild_entity_source_credentials.SourceCredentialsList"
title: "source_credentials_list"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to list and delete the internal credentials used to access internal repositories from Codebuild.

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/access-tokens.html

## Columns

• **arn**: `string`

AWS ARN to identify the build

• **auth\_type**: [`PERSONAL_ACCESS_TOKEN`](../enums/aws_codebuild_entity_source_credentials.AuthType.md#personal_access_token)

Type of authentication provided by this credential

• **region**: `string`

Region for the credential

• **source\_type**: [`source_type`](../enums/aws_codebuild_entity_project.SourceType.md)

Type of source code used in the project
