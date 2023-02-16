---
id: "aws_codedeploy_entity_deployment.CodedeployDeployment"
title: "codedeploy_deployment"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to list existing AWS CodeDeploy deployments. A deployment is the process, and the components involved in the process,
of installing content on one or more instances.

**`See`**

https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments.html

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
