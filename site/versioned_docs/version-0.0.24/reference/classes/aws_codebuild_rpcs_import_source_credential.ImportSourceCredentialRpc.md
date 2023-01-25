---
id: "aws_codebuild_rpcs_import_source_credential.ImportSourceCredentialRpc"
title: "Method: import_source_credential"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method for importing a credentials used for pulling sources in codebuild

Returns following columns:

- arn: the aws resource name for the credential saved

- status: OK if the build was started successfully

- message: Error message in case of failure

**`Example`**

```sql TheButton[Import Github credentials to CodeBuild]="Import Github credentials to CodeBuild"
  SELECT * FROM import_source_credential('us-east-1', 'ghp_XXX', 'GITHUB', 'PERSONAL_ACCESS_TOKEN');
```

**`See`**

https://docs.aws.amazon.com/cli/latest/reference/codebuild/import-source-credentials.html
