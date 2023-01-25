---
id: "aws_codedeploy_entity_deployment.CodedeployDeployment"
title: "Table: codedeploy_deployment"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to list existing AWS CodeDeploy deployments. A deployment is the process, and the components involved in the process,
of installing content on one or more instances.

**`Example`**

```sql TheButton[List CodeDeploy deployments]="List CodeDeploy deployments"
SELECT * FROM codedeploy_deployment WHERE application_id = (SELECT id FROM codedeploy_application WHERE name = 'application_name');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codedeploy-integration.ts#L595
 - https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments.html

## Columns

• **application**: [`codedeploy_application`](aws_codedeploy_entity_application.CodedeployApplication.md)

Reference for the application to where the deployment belongs

• **deployment\_group**: [`codedeploy_deployment_group`](aws_codedeploy_entity_deploymentGroup.CodedeployDeploymentGroup.md)

Reference for the deployment group to where the deployment belongs

• `Optional` **deployment\_id**: `string`

Internal AWS ID for the deployment

• `Optional` **description**: `string`

Description to identify the deployment group

• `Optional` **external\_id**: `string`

The unique ID for an external resource (for example, a CloudFormation stack ID) that is linked to this deployment.

**`See`**

https://docs.aws.amazon.com/codedeploy/latest/APIReference/API_DeploymentInfo.html

• `Optional` **location**: `Object`

Complex type to identified the location used by the deployment. It has specific configurations
for Github or S3

**`See`**

https://docs.aws.amazon.com/codedeploy/latest/APIReference/API_RevisionLocation.html

#### Type declaration

| Name | Type |
| :------ | :------ |
| `github_location` | { `commit_id?`: `string` ; `repository?`: `string`  } |
| `github_location_commit_id` | `string` |
| `github_location_repository` | `string` |
| `revision_type` | [`revision_type`](../enums/aws_codedeploy_entity_deployment.RevisionType.md) |
| `s3_location` | { `bucket?`: `string` ; `key?`: `string`  } |
| `s3_location_bucket` | `string` |
| `s3_location_key` | `string` |

• **region**: `string`

Region for the Codedeploy deployment

• `Optional` **status**: [`deployment_status`](../enums/aws_codedeploy_entity_deployment.DeploymentStatusEnum.md)

Current status of the deployment
