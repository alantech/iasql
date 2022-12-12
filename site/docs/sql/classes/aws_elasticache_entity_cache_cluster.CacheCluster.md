---
id: "aws_elasticache_entity_cache_cluster.CacheCluster"
title: "Table: cache_cluster"
sidebar_label: "cache_cluster"
custom_edit_url: null
---

Table to manage ElastiCache clusters

**`Example`**

```sql
INSERT INTO cache_cluster (cluster_id, node_type, engine, num_nodes) VALUES ('cluster_name', 'cache.t1.micro', 'redis', 1);
SELECT * FROM cache_cluster WHERE cluster_id='cluster_name';
DELETE FROM cache_cluster WHERE cluster_id = 'cluster_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-elasticache-integration.ts#L146
 - https://docs.aws.amazon.com/AmazonElastiCache/latest/mem-ug/Clusters.html

## Columns

• **cluster\_id**: `string`

Internal AWS ID for the cluster

___

• **engine**: [`engine`](../enums/aws_elasticache_entity_cache_cluster.Engine.md)

Engine to use for the cluster

___

• **node\_type**: `string`

Node type to use as a base for the cluster deployment

**`See`**

https://docs.aws.amazon.com/AmazonElastiCache/latest/mem-ug/CacheNodes.SupportedTypes.html
TODO: convert it to an independent table in the future

___

• `Optional` **num\_nodes**: `number`

Number of nodes to deploy for this specific cluster

**`See`**

https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/cluster-create-determine-requirements.html

___

• **region**: `string`

Region for the cluster
