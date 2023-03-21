---
id: "aws_ecs_fargate"
title: "aws_ecs_fargate"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [cluster](../../aws/tables/aws_ecs_fargate_entity_cluster.Cluster)

    [container_definition](../../aws/tables/aws_ecs_fargate_entity_container_definition.ContainerDefinition)

    [service](../../aws/tables/aws_ecs_fargate_entity_service.Service)

    [task_definition](../../aws/tables/aws_ecs_fargate_entity_task_definition.TaskDefinition)

### Functions
    [deploy_service](../../aws/tables/aws_ecs_fargate_rpcs_deploy_service.DeployServiceRPC)

### Enums
    [transport_protocol](../../aws/enums/aws_ecs_fargate_entity_container_definition.TransportProtocol)

    [assign_public_ip](../../aws/enums/aws_ecs_fargate_entity_service.AssignPublicIp)

    [cpu_mem_combination](../../aws/enums/aws_ecs_fargate_entity_task_definition.CpuMemCombination)

    [task_definition_status](../../aws/enums/aws_ecs_fargate_entity_task_definition.TaskDefinitionStatus)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

```testdoc
modules/aws-ecs-integration.ts#ECS Integration Testing#Manage ECS
modules/aws-ecs-ecr-integration.ts#ECS Integration Testing#Integrate with aws_ecr private repos
modules/aws-ecs-pub-ecr-integration.ts#ECS Integration Testing#Integrate with aws_ecr public repos

```

</TabItem>
</Tabs>
