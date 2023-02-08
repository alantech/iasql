---
id: "aws_codebuild"
title: "aws_codebuild"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="Components" label="Components" default>

### Tables

    [codebuild_build_list](../../classes/aws_codebuild_entity_build.CodebuildBuildList)

    [codebuild_project](../../classes/aws_codebuild_entity_project.CodebuildProject)

    [source_credentials_list](../../classes/aws_codebuild_entity_source_credentials.SourceCredentialsList)

### Functions
    [import_source_credential](../../classes/aws_codebuild_rpcs_import_source_credential.ImportSourceCredentialRpc)

    [start_build](../../classes/aws_codebuild_rpcs_start_build.StartBuildRPC)

### Enums
    [build_status](../../enums/aws_codebuild_entity_build.BuildStatus)

    [compute_type](../../enums/aws_codebuild_entity_project.ComputeType)

    [environment_type](../../enums/aws_codebuild_entity_project.EnvironmentType)

    [environment_variable_type](../../enums/aws_codebuild_entity_project.EnvironmentVariableType)

    [source_type](../../enums/aws_codebuild_entity_project.SourceType)

    [auth_type](../../enums/aws_codebuild_entity_source_credentials.AuthType)

    [valid_auth_types](../../enums/aws_codebuild_rpcs_import_source_credential.ValidAuthTypes)

    [valid_server_types](../../enums/aws_codebuild_rpcs_import_source_credential.ValidServerTypes)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

```testdoc
modules/aws-codebuild-integration.ts#AwsCodebuild Integration Testing#Manage Codebuild
```

</TabItem>
</Tabs>
