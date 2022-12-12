---
id: "aws_codedeploy_entity_deploymentGroup.CodedeployDeploymentGroup"
title: "Table: codedeploy_deployment_group"
sidebar_label: "codedeploy_deployment_group"
custom_edit_url: null
---

Table to manage AWS CodeDeploy deployment group entities. You can specify one or more deployment groups
for a CodeDeploy application. Each application deployment uses one of its deployment groups.
The deployment group contains settings and configurations used during the deployment.

**`Example`**

```sql
INSERT INTO codedeploy_deployment_group (application_id, name, role_name) VALUES
((SELECT id FROM codedeploy_application WHERE name = 'application-name'), 'deployment-group-name', 'role-name');
SELECT * FROM codedeploy_deployment_group WHERE name='deployment-group-name';
DELETE FROM codedeploy_deployment_group WHERE name = 'deployment-group-name'
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codedeploy-integration.ts#L419
 - https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-groups.html

## Columns

• **application**: [`codedeploy_application`](aws_codedeploy_entity_application.CodedeployApplication.md)

Reference for the application to where this deployment group belongs

___

• **deployment\_config\_name**: [`deployment_config_type`](../enums/aws_codedeploy_entity_deploymentGroup.DeploymentConfigType.md)

Deployment model to follow

___

• `Optional` **deployment\_group\_id**: `string`

Internal AWS ID for the deployment group

___

• `Optional` **deployments**: [`codedeploy_deployment`](aws_codedeploy_entity_deployment.CodedeployDeployment.md)[]

List of the current deployments associated to this group

___

• `Optional` **ec2\_tag\_filters**: { `key`: `undefined` \| `string` ; `type`: [`ec2_tag_filter_type`](../enums/aws_codedeploy_entity_deploymentGroup.EC2TagFilterType.md) ; `value`: `undefined` \| `string`  }[]

Complex type used to filter the instances where the application will be deployed

**`See`**

https://docs.aws.amazon.com/codedeploy/latest/userguide/instances-tagging.html

___

• **name**: `string`

Name for the Codedeploy deployment group

___

• **region**: `string`

Region for the Codedeploy deployment group

___

• `Optional` **role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

Reference for the AWS role used by this deployment group
