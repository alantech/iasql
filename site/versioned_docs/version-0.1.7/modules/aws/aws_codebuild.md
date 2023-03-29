---
id: "aws_codebuild"
title: "aws_codebuild"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [codebuild_build_list](../../aws/tables/aws_codebuild_entity_build.CodebuildBuildList)

    [codebuild_project](../../aws/tables/aws_codebuild_entity_project.CodebuildProject)

    [source_credentials_list](../../aws/tables/aws_codebuild_entity_source_credentials.SourceCredentialsList)

### Functions
    [import_source_credential](../../aws/tables/aws_codebuild_rpcs_import_source_credential.ImportSourceCredentialRpc)

    [start_build](../../aws/tables/aws_codebuild_rpcs_start_build.StartBuildRPC)

### Enums
    [build_status](../../aws/enums/aws_codebuild_entity_build.BuildStatus)

    [compute_type](../../aws/enums/aws_codebuild_entity_project.ComputeType)

    [environment_type](../../aws/enums/aws_codebuild_entity_project.EnvironmentType)

    [environment_variable_type](../../aws/enums/aws_codebuild_entity_project.EnvironmentVariableType)

    [source_type](../../aws/enums/aws_codebuild_entity_project.SourceType)

    [auth_type](../../aws/enums/aws_codebuild_entity_source_credentials.AuthType)

    [valid_auth_types](../../aws/enums/aws_codebuild_rpcs_import_source_credential.ValidAuthTypes)

    [valid_server_types](../../aws/enums/aws_codebuild_rpcs_import_source_credential.ValidServerTypes)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

```testdoc
modules/aws-codebuild-integration.ts#AwsCodebuild Integration Testing#Manage Codebuild
```

</TabItem>
</Tabs>
