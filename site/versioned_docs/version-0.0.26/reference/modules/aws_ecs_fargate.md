---
id: "aws_ecs_fargate"
title: "aws_ecs_fargate"
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

    [cluster](../../classes/aws_ecs_fargate_entity_cluster.Cluster)

    [container_definition](../../classes/aws_ecs_fargate_entity_container_definition.ContainerDefinition)

    [service](../../classes/aws_ecs_fargate_entity_service.Service)

    [task_definition](../../classes/aws_ecs_fargate_entity_task_definition.TaskDefinition)

### Functions
    [deploy_service](../../classes/aws_ecs_fargate_rpcs_deploy_service.DeployServiceRPC)

### Enums
    [transport_protocol](../../enums/aws_ecs_fargate_entity_container_definition.TransportProtocol)

    [assign_public_ip](../../enums/aws_ecs_fargate_entity_service.AssignPublicIp)

    [cpu_mem_combination](../../enums/aws_ecs_fargate_entity_task_definition.CpuMemCombination)

    [task_definition_status](../../enums/aws_ecs_fargate_entity_task_definition.TaskDefinitionStatus)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

```testdoc
modules/aws-ecs-integration.ts#ECS Integration Testing#Manage ECS
modules/aws-ecs-ecr-integration.ts#ECS Integration Testing#Integrate with aws_ecr private repos
modules/aws-ecs-pub-ecr-integration.ts#ECS Integration Testing#Integrate with aws_ecr public repos

```

</TabItem>
</Tabs>
