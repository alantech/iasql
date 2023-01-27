---
id: "aws_codebuild_entity_source_credentials.SourceCredentialsList"
title: "Table: source_credentials_list"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to list and delete the internal credentials used to access internal repositories from Codebuild.

**`Example`**

```sql TheButton[Manage SourceCredentials for CodeBuild]="Manage SourceCredentials for CodeBuild"
SELECT * FROM source_credentials_list WHERE source_type = 'GITHUB';
DELETE FROM source_credentials_list WHERE source_type = 'GITHUB';
```

**`See`**

 - https://github.com/iasql/iasql/blob/main/test/modules/aws-codebuild-integration.ts#L217
 - https://docs.aws.amazon.com/codebuild/latest/userguide/access-tokens.html

## Columns

• **arn**: `string`

AWS ARN to identify the build

• **auth\_type**: [`PERSONAL_ACCESS_TOKEN`](../enums/aws_codebuild_entity_source_credentials.AuthType.md#personal_access_token)

Type of authentication provided by this credential

• **region**: `string`

Region for the credential

• **source\_type**: [`source_type`](../enums/aws_codebuild_entity_project.SourceType.md)

Type of source code used in the project
