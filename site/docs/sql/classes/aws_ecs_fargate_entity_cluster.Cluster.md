---
id: "aws_ecs_fargate_entity_cluster.Cluster"
title: "Table: cluster"
sidebar_label: "cluster"
custom_edit_url: null
---

Table to manage AWS ECS clusters.

**`Example`**

```sql
INSERT INTO cluster (cluster_name) VALUES('cluster_name');
SELECT * FROM cluster WHERE cluster_name = 'cluster_name';
DELETE FROM cluster WHERE cluster_name = 'cluster_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L198
 - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/clusters.html

## Columns

• `Optional` **cluster\_arn**: `string`

AWS ARN identifier for the cluster

___

• **cluster\_name**: `string`

Name of the cluster

___

• `Optional` **cluster\_status**: `string`

Current status of the cluster

___

• **region**: `string`

Reference to the associated region
