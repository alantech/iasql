---
id: "aws_memory_db_entity_memory_db_cluster.MemoryDBCluster"
title: "Table: memory_db_cluster"
sidebar_label: "memory_db_cluster"
custom_edit_url: null
---

Table to manage Memory DB clusters

**`Example`**

```sql
INSERT INTO memory_db_cluster (cluster_name, subnet_group_id) VALUES ('cluster_name', (select id from subnet_group where subnet_group_name = 'subnet_name'));
SELECT * FROM memory_db_cluster WHERE cluster_name = 'cluster_name';
DELETE FROM memory_db_cluster WHERE cluster_name = 'cluster_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-memory-db-integration.ts#L185
 - https://docs.aws.amazon.com/memorydb/latest/devguide/clusters.html

## Columns

• `Optional` **address**: `string`

Address for the memory db cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/nodes-connecting.html

___

• `Optional` **arn**: `string`

AWS ARN to identify the cluster

___

• **cluster\_name**: `string`

Name for the cluster

___

• `Optional` **description**: `string`

Description for the cluster

___

• **node\_type**: [`node_type`](../enums/aws_memory_db_entity_memory_db_cluster.NodeTypeEnum.md)

Node type used for the nodes of the cluster

___

• **port**: `number`

Port for the memory db cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/nodes-connecting.html

___

• **region**: `string`

Region for the cluster

___

• `Optional` **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to the security groups associated with the cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/memorydb-vpc-accessing.html

___

• `Optional` **status**: `string`

Current status of the cluster
todo: enum?

___

• **subnet\_group**: [`subnet_group`](aws_memory_db_entity_subnet_group.SubnetGroup.md)

Reference to the subnet groups associated with the cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/subnetgroups.html

___

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the cluster

**`See`**

https://docs.aws.amazon.com/memorydb/latest/devguide/tagging-resources.html

#### Index signature

▪ [key: `string`]: `string`
