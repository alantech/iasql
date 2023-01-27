---
id: "aws_codebuild_rpcs_start_build.StartBuildRPC"
title: "Method: start_build"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method for triggering the build of a project

Returns following columns:

- name: the name of the project that was built

- status: OK if the build was started successfully

- message: Error message in case of failure

**`Example`**

```sql TheButton[Launch CodeBuild project build]="Launch CodeBuild project build"
  SELECT * FROM start_build('project_name', 'us-east-2');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codebuild-integration.ts#L313
 - https://docs.aws.amazon.com/cli/latest/reference/codebuild/start-build.html

## Columns
