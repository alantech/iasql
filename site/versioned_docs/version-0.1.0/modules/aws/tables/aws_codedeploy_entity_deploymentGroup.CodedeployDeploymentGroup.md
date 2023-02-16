---
id: "aws_codedeploy_entity_deploymentGroup.CodedeployDeploymentGroup"
title: "codedeploy_deployment_group"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS CodeDeploy deployment group entities. You can specify one or more deployment groups
for a CodeDeploy application. Each application deployment uses one of its deployment groups.
The deployment group contains settings and configurations used during the deployment.

**`See`**

https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups.html

## Columns

• **application**: [`codedeploy_application`](aws_codedeploy_entity_application.CodedeployApplication.md)

Reference for the application to where this deployment group belongs

• **deployment\_config\_name**: [`deployment_config_type`](../enums/aws_codedeploy_entity_deploymentGroup.DeploymentConfigType.md)

Deployment model to follow

• `Optional` **deployment\_group\_id**: `string`

AWS generated ID for the deployment group

• `Optional` **deployment\_style**: `Object`

Information about the type of deployment, in-place or blue/green, that you want to run and whether to route deployment traffic behind a load balancer.

#### Type declaration

| Name | Type |
| :------ | :------ |
| `deployment_option` | [`deployment_option`](../enums/aws_codedeploy_entity_deploymentGroup.DeploymentOption.md) |
| `deployment_type` | [`deployment_type`](../enums/aws_codedeploy_entity_deploymentGroup.DeploymentType.md) |

• `Optional` **deployments**: [`codedeploy_deployment`](aws_codedeploy_entity_deployment.CodedeployDeployment.md)[]

List of the current deployments associated to this group

• `Optional` **ec2\_tag\_filters**: { `key`: `undefined` \| `string` ; `type`: [`ec2_tag_filter_type`](../enums/aws_codedeploy_entity_deploymentGroup.EC2TagFilterType.md) ; `value`: `undefined` \| `string`  }[]

Complex type used to filter the instances where the application will be deployed

**`See`**

https://docs.aws.amazon.com/codedeploy/latest/userguide/instances-tagging.html

• **name**: `string`

Name for the Codedeploy deployment group

• **region**: `string`

Region for the Codedeploy deployment group

• `Optional` **role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

Reference for the AWS role used by this deployment group
