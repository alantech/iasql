---
id: "aws_codebuild_entity_build.CodebuildBuildList"
title: "Table: codebuild_build_list"
sidebar_label: "codebuild_build_list"
custom_edit_url: null
---

Table to manage AWS CodeBuild build entities. This table can only be used
to check the existing builds, and delete them. The main builds are created
via a CodeBuild project.

**`Example`**

```sql
SELECT * FROM codebuild_build_list WHERE project_name = 'build_project_name' and build_status = 'FAILED';
DELETE FROM codebuild_build_list WHERE project_name = 'build_project_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codebuild-integration.ts#L341
 - https://docs.aws.amazon.com/codebuild/latest/userguide/builds-working.html

## Columns

• **arn**: `string`

AWS ARN to identify the build

___

• **aws\_id**: `string`

Internal ID to identify the build

___

• `Optional` **build\_number**: `number`

The number of the build. For each project, the buildNumber of its first build is 1. The buildNumber of each subsequent build is incremented by 1. If a build is deleted, the buildNumber of other builds does not change.

___

• **build\_status**: [`build_status`](../enums/aws_codebuild_entity_build.BuildStatus.md)

Current status for the build

___

• `Optional` **end\_time**: `date`

Time when the build finished

___

• **project**: [`codebuild_project`](aws_codebuild_entity_project.CodebuildProject.md)

Associated project for the build. AWS allows builds to exist once the project has been deleted

___

• **region**: `string`

Region for the certificate creation

___

• `Optional` **start\_time**: `date`

Time when the build was started
