---
id: "aws_ecs_fargate_entity_task_definition.TaskDefinition"
title: "task_definition"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS ECS task definitions. A task definition is required to run Docker containers in Amazon ECS.

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html

## Columns

• **container\_definitions**: [`container_definition`](aws_ecs_fargate_entity_container_definition.ContainerDefinition.md)[]

Reference to the container definitions that are passed to the Docker daemon on a container instance.

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definitions

• **cpu\_memory**: [`cpu_mem_combination`](../enums/aws_ecs_fargate_entity_task_definition.CpuMemCombination.md)

When you register a task definition, you can specify the total CPU and memory used for the task.
This is separate from the cpu and memory values at the container definition level.

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size

• `Optional` **execution\_role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

The Amazon Resource Name (ARN) of the task execution role that grants the Amazon ECS container agent permission to make AWS API
calls on your behalf. The task execution IAM role is required depending on the requirements of your task.

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html

• **family**: `string`

When you register a task definition, you give it a family, which is similar to a name for multiple versions of the task definition,
specified with a revision number. The first task definition that's registered into a particular family is given a revision of 1,
and any task definitions registered after that are given a sequential revision number.

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html

• **region**: `string`

Region for the ECS service

• `Optional` **revision**: `number`

Revision number to combine with the family parameter

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html

• `Optional` **status**: [`task_definition_status`](../enums/aws_ecs_fargate_entity_task_definition.TaskDefinitionStatus.md)

If the task is currently active or not

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html

• `Optional` **task\_role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

When you register a task definition, you can provide a task role for an IAM role that allows the containers in the task permission
to call the AWS APIs that are specified in its associated policies on your behalf.

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
