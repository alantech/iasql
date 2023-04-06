---
id: "aws_codedeploy_entity_application.CodedeployApplication"
title: "codedeploy_application"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS CodeDeploy application entities. An application is simply a name or container used
by CodeDeploy to ensure that the correct revision, deployment configuration, and deployment group are
referenced during a deployment.

**`See`**

https://docs.aws.amazon.com/codedeploy/latest/userguide/applications-create.html

## Columns

• `Optional` **application\_id**: `string`

AWS generated ID for the application

• **compute\_platform**: [`compute_platform`](../enums/aws_codedeploy_entity_application.ComputePlatform.md)

Compute platform where the application will run

• `Optional` **deployment\_groups**: [`codedeploy_deployment_group`](aws_codedeploy_entity_deploymentGroup.CodedeployDeploymentGroup.md)[]

Deployment groups attached to this specific application

**`See`**

https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups.html

• **name**: `string`

Name for the Codedeploy application

• **region**: `string`

Region for the Codedeploy application
