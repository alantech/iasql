---
id: "aws_codebuild_entity_build.CodebuildBuildImport"
title: "Table: codebuild_build_import"
sidebar_label: "codebuild_build_import"
custom_edit_url: null
---

Table to trigger a new CodeBuild build for an existing project.
When a new entry is created on the table, the referenced build is started.

**`Example`**

```sql
INSERT INTO codebuild_build_import (project_name) VALUES ('project_name');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codebuild-integration.ts#L315
 - https://docs.aws.amazon.com/cli/latest/reference/codebuild/start-build.html

## Columns

• **project**: [`codebuild_project`](aws_codebuild_entity_project.CodebuildProject.md)

Project name for the triggered build

___

• **region**: `string`

Region for the Codebuild project
