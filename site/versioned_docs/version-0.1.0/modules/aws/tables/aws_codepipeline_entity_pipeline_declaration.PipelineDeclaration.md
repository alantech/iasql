---
id: "aws_codepipeline_entity_pipeline_declaration.PipelineDeclaration"
title: "pipeline_declaration"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Codepipeline entities. AWS CodePipeline is a continuous delivery service you can
use to model, visualize, and automate the steps required to release your software.

**`See`**

https://docs.aws.amazon.com/codepipeline/latest/userguide/welcome.html

## Columns

• **artifact\_store**: `artifact_store`

Complex type used to specify the storage for the produced artifacts

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-codepipeline/modules/artifactstore.html

• **name**: `string`

Name for the Codedeploy pipeline declaration

• **region**: `string`

Region for the Codedeploy deployment group

• **service\_role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

Reference for the AWS role used by this deployment group

• `Optional` **stages**: `stage_declaration`[]

Complex type used to specify all the stages for this pipeline

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-codepipeline/modules/stagedeclaration.html
