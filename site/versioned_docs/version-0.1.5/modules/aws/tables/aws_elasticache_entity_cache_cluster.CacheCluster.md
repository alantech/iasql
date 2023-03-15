---
id: "aws_elasticache_entity_cache_cluster.CacheCluster"
title: "cache_cluster"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage ElastiCache clusters. A cluster is a collection of one or more cache nodes, all of which run an instance of the Redis
cache engine software. When you create a cluster, you specify the engine and version for all of the nodes to use.

**`See`**

https://docs.aws.amazon.com/AmazonElastiCache/latest/mem-ug/Clusters.html

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
