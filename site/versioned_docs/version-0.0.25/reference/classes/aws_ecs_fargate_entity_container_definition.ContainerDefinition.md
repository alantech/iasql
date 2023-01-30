---
id: "aws_ecs_fargate_entity_container_definition.ContainerDefinition"
title: "Table: container_definition"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS ECS container definitions. Container definitions are used in task definitions to describe the different containers that are launched as part of a task.

**`Example`**

```sql TheButton[Manage an ECS container definition]="Manage an ECS container definition"
INSERT INTO container_definition ("name", image, essential, memory_reservation, host_port, container_port, protocol, env_variables, task_definition_id, log_group_id)
VALUES('container_name', 'image_name', true, 2048, 6379, 6379, 'tcp', '{ "test": 2}', (select id from task_definition where family = 'task_definition' and status is null
and region = 'us-east-1' limit 1), (select id from log_group where log_group_name = 'log_group' and region = 'us-east-1'));

SELECT * FROM container_definition WHERE name = 'container_name' AND image = 'image_name';

DELETE FROM container_definition using task_definition where container_definition.task_definition_id = task_definition.id and task_definition.family = 'task_name';
```

**`See`**

 - https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L400
 - https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_ContainerDefinition.html

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
