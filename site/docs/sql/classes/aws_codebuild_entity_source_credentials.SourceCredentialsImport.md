---
id: "aws_codebuild_entity_source_credentials.SourceCredentialsImport"
title: "Table: source_credentials_import"
sidebar_label: "source_credentials_import"
custom_edit_url: null
---

Table to create the internal credentials used to access internal repositories from Codebuild.

**`Example`**

```sql
INSERT INTO source_credentials_import (token, source_type, auth_type) VALUES ('<personal_access_token>', 'GITHUB', 'PERSONAL_ACCESS_TOKEN');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codebuild-integration.ts#L161
 - https://docs.aws.amazon.com/codebuild/latest/userguide/access-tokens.html

## Columns

• **auth\_type**: [`PERSONAL_ACCESS_TOKEN`](../enums/aws_codebuild_entity_source_credentials.AuthType.md#personal_access_token)

Type of authentication that is used in this credential

___

• **region**: `string`

Region for the Codebuild project

___

• **source\_type**: [`source_type`](../enums/aws_codebuild_entity_project.SourceType.md)

Type of source where this credential will be used
TODO implement for BASIC_AUTH with Bitbucket: // @Column() // username: string;

___

• **token**: `string`

Token for the specific credential that wants to be created
