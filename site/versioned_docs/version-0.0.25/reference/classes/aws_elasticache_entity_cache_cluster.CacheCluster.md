---
id: "aws_elasticache_entity_cache_cluster.CacheCluster"
title: "Table: cache_cluster"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage ElastiCache clusters. A cluster is a collection of one or more cache nodes, all of which run an instance of the Redis
cache engine software. When you create a cluster, you specify the engine and version for all of the nodes to use.

**`Example`**

```sql TheButton[Manage an ElastiCache cluster]="Manage an ElastiCache cluster"
INSERT INTO cache_cluster (cluster_id, node_type, engine, num_nodes) VALUES ('cluster_name', 'cache.t1.micro', 'redis', 1);
SELECT * FROM cache_cluster WHERE cluster_id='cluster_name';
DELETE FROM cache_cluster WHERE cluster_id = 'cluster_name';
```

**`See`**

 - https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-elasticache-integration.ts#L146
 - https://docs.aws.amazon.com/AmazonElastiCache/latest/mem-ug/Clusters.html

## Columns

• **cluster\_id**: `string`

Internal AWS ID for the cluster

• **engine**: [`engine`](../enums/aws_elasticache_entity_cache_cluster.Engine.md)

Engine to use for the cluster

• **node\_type**: `string`

Node type to use as a base for the cluster deployment

**`See`**

https://docs.aws.amazon.com/AmazonElastiCache/latest/mem-ug/CacheNodes.SupportedTypes.html

• `Optional` **num\_nodes**: `number`

Number of nodes to deploy for this specific cluster

**`See`**

https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/cluster-create-determine-requirements.html

• **region**: `string`

Region for the cluster
