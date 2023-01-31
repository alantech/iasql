---
id: "aws_codepipeline_entity_pipeline_declaration.PipelineDeclaration"
title: "Table: pipeline_declaration"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS Codepipeline entities. AWS CodePipeline is a continuous delivery service you can
use to model, visualize, and automate the steps required to release your software.

**`Example`**

```sql TheButton[Create a new CodePipeline declaration]="Create a new CodePipeline declaration"
INSERT INTO pipeline_declaration (name, service_role_name, stages, artifact_store)
VALUES ('pipeline-name', 'pipeline-role', "{
 name: 'Source',
  actions: [
    {
      name: 'SourceAction',
      actionTypeId: {
        category: 'Source',
        owner: 'ThirdParty',
        version: '1',
        provider: 'GitHub',
      },
      configuration: {
        Owner: 'iasql',
        Repo: 'iasql-codedeploy-example',
        Branch: 'main',
        OAuthToken: `<personal_access_token>`,
      },
      outputArtifacts: [
        {
          name: 'Source',
        },
      ],
    },
  ],
},
{
  name: 'Deploy',
  actions: [
    {
      name: 'DeployApp',
      actionTypeId: {
        category: 'Deploy',
        owner: 'AWS',
        version: '1',
        provider: 'CodeDeploy',
      },
      configuration: {
        ApplicationName: `target-application`,
        DeploymentGroupName: `deployment-group`,
      },
      inputArtifacts: [
        {
          name: 'Source',
        },
      ],
    },
  ],
},',
'{ type: 'S3', location: 's3-bucket' }'");
```

**`See`**

 - https://github.com/iasql/iasql/blob/main/test/modules/aws-codepipeline-integration.ts#L424
 - https://docs.aws.amazon.com/codepipeline/latest/userguide/welcome.html

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
