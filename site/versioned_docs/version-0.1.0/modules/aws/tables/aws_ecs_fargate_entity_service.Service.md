---
id: "aws_ecs_fargate_entity_service.Service"
title: "service"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS ECS services. You can use an Amazon ECS service to run and maintain a specified number of instances of a
task definition simultaneously in an Amazon ECS cluster. If one of your tasks fails or stops, the Amazon ECS service
scheduler launches another instance of your task definition to replace it. This helps maintain your desired number of tasks in the service.

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html

## Columns

• `Optional` **arn**: `string`

AWS ARN for the service

• **assign\_public\_ip**: [`assign_public_ip`](../enums/aws_ecs_fargate_entity_service.AssignPublicIp.md)

Whether to assign a public IP to the service

• `Optional` **cluster**: [`cluster`](aws_ecs_fargate_entity_cluster.Cluster.md)

Reference to the cluster where the service belongs to

• `Optional` **desired\_count**: `number`

The desired number of instantiations of the task definition to keep running on the service.

• **name**: `string`

Name of the container definition

• **region**: `string`

Region for the ECS service

• **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to all the security groups used by the service

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/service.html#networkconfiguration

• `Optional` **status**: `string`

Current status of the service

• **subnets**: `string`[]

Ids of all the VPC subnets used by the service

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/service.html#networkconfiguration

• `Optional` **target\_group**: [`target_group`](aws_elb_entity_target_group.TargetGroup.md)

Reference of the target group that will be associated with the service, to expose it via load balancers

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/register-multiple-targetgroups.html

• `Optional` **task**: [`task_definition`](aws_ecs_fargate_entity_task_definition.TaskDefinition.md)

Reference to the task definition that uses the service
