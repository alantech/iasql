---
id: "aws_ecs_fargate_entity_container_definition.ContainerDefinition"
title: "container_definition"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS ECS container definitions. Container definitions are used in task definitions to describe the different containers that are launched as part of a task.

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_ContainerDefinition.html

`image` > `repository` > `publicRepository`
`digest` > `tag` > null

## Columns

• `Optional` **container\_port**: `number`

Port to expose at container level

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#portmappings

• `Optional` **cpu**: `number`

The number of cpu units reserved for the container.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#cpu

• `Optional` **digest**: `string`

The sha-256 digest of the used image. Either tag or digest needs to be specified

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#image

• **env\_variables**: `Object`

Complex type to specify a list of environment variables that the container can consume

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#environment

#### Type definition

▪ [key: `string`]: `string`

• **essential**: `boolean`

If the essential parameter of a container is marked as true, and that container fails or stops for any reason,
all other containers that are part of the task are stopped. If the essential parameter of a container is marked as false,
its failure doesn't affect the rest of the containers in a task. If this parameter is omitted, a container is
assumed to be essential.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#essential

• `Optional` **host\_port**: `number`

Port to expose at host level. It can be left blank depending on the networking mode

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#portmappings

• `Optional` **image**: `string`

The image used to start the container

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#image

• `Optional` **log\_group**: [`log_group`](aws_cloudwatch_entity_log_group.LogGroup.md)

The log group where to render the container logs

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#logconfiguration

• `Optional` **memory**: `number`

The amount (in MiB) of memory to present to the container.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#memory

• `Optional` **memory\_reservation**: `number`

The soft limit (in MiB) of memory to reserve for the container.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#memoryreservation

• **name**: `string`

Name of the container definition

• `Optional` **protocol**: [`transport_protocol`](../enums/aws_ecs_fargate_entity_container_definition.TransportProtocol.md)

The protocol for the exposed ports

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#portmappings

• `Optional` **public\_repository**: [`public_repository`](aws_ecr_entity_public_repository.PublicRepository.md)

Reference to the public repository where this image is hosted

• **region**: `string`

Region for the container definition

• `Optional` **repository**: [`repository`](aws_ecr_entity_repository.Repository.md)

Reference of the repository where this image is hosted

• `Optional` **tag**: `string`

The tag for the image used to start the container

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/containerdefinition.html#image

• **task\_definition**: [`task_definition`](aws_ecs_fargate_entity_task_definition.TaskDefinition.md)

Reference of the associated task definition
