---
id: "aws_codedeploy"
title: "aws_codedeploy"
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

    [codedeploy_application](../../classes/aws_codedeploy_entity_application.CodedeployApplication)

    [codedeploy_deployment](../../classes/aws_codedeploy_entity_deployment.CodedeployDeployment)

    [codedeploy_deployment_group](../../classes/aws_codedeploy_entity_deploymentGroup.CodedeployDeploymentGroup)

### Functions
    [start_deploy](../../classes/aws_codedeploy_rpcs_start_deploy.StartDeployRPC)

### Enums
    [compute_platform](../../enums/aws_codedeploy_entity_application.ComputePlatform)

    [deployment_status](../../enums/aws_codedeploy_entity_deployment.DeploymentStatusEnum)

    [revision_type](../../enums/aws_codedeploy_entity_deployment.RevisionType)

    [deployment_config_type](../../enums/aws_codedeploy_entity_deploymentGroup.DeploymentConfigType)

    [deployment_option](../../enums/aws_codedeploy_entity_deploymentGroup.DeploymentOption)

    [deployment_type](../../enums/aws_codedeploy_entity_deploymentGroup.DeploymentType)

    [ec2_tag_filter_type](../../enums/aws_codedeploy_entity_deploymentGroup.EC2TagFilterType)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

```testdoc
modules/aws-codedeploy-integration.ts#AwsCodedeploy Integration Testing#Manage Codedeploy
```

</TabItem>
</Tabs>
