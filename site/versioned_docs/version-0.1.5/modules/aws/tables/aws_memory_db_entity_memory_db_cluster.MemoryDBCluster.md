---
id: "aws_memory_db_entity_memory_db_cluster.MemoryDBCluster"
title: "memory_db_cluster"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage Memory DB clusters. Amazon MemoryDB for Redis is a Redis-compatible, durable, in-memory
database service that delivers ultra-fast performance. It is purpose-built for modern applications with microservices architectures.

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/clusters.html

## Columns

• `Optional` **address**: `string`

Address for the memory db cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/nodes-connecting.html

• `Optional` **arn**: `string`

AWS ARN to identify the cluster

• **cluster\_name**: `string`

Name for the cluster

• `Optional` **description**: `string`

Description for the cluster

• **node\_type**: [`node_type`](../enums/aws_memory_db_entity_memory_db_cluster.NodeTypeEnum.md)

Node type used for the nodes of the cluster

• **port**: `number`

Port for the memory db cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/nodes-connecting.html

• **region**: `string`

Region for the cluster

• `Optional` **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to the security groups associated with the cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/memorydb-vpc-accessing.html

• `Optional` **status**: `string`

Current status of the cluster
todo: enum?

• **subnet\_group**: [`subnet_group`](aws_memory_db_entity_subnet_group.SubnetGroup.md)

Reference to the subnet groups associated with the cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/subnetgroups.html

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/tagging-resources.html

#### Type definition

▪ [key: `string`]: `string`
