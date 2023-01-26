---
id: "aws_codedeploy_entity_application.CodedeployApplication"
title: "Table: codedeploy_application"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS CodeDeploy application entities. An application is simply a name or container used
by CodeDeploy to ensure that the correct revision, deployment configuration, and deployment group are
referenced during a deployment.

**`Example`**

```sql TheButton[Manage a CodeDeploy app]="Manage a CodeDeploy app"
INSERT INTO codedeploy_application (name, compute_platform) VALUES ('application-name', 'Server');
SELECT * FROM codedeploy_application WHERE name='application-name';
DELETE FROM codedeploy_application WHERE name = 'application-name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codedeploy-integration.ts#L289
 - https://docs.aws.amazon.com/codedeploy/latest/userguide/applications-create.html

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
