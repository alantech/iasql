---
id: "aws_ecs_fargate_entity_cluster.Cluster"
title: "Table: cluster"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS ECS clusters. AWS Fargate is a technology that you can use with Amazon ECS to run containers
without having to manage servers or clusters of Amazon EC2 instances.

An Amazon ECS cluster is a logical grouping of tasks or services. Your tasks and services are run on infrastructure that is registered to a cluster.
The infrastructure capacity can be provided by AWS Fargate, which is serverless infrastructure that AWS manages, Amazon EC2 instances that you manage,
or an on-premise server or virtual machine (VM) that you manage remotely.

**`Example`**

```sql TheButton[Manage an ECS cluster]="Manage an ECS cluster"
INSERT INTO cluster (cluster_name) VALUES('cluster_name');
SELECT * FROM cluster WHERE cluster_name = 'cluster_name';
DELETE FROM cluster WHERE cluster_name = 'cluster_name';
```

**`See`**

 - https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L198
 - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/clusters.html

## Columns

• `Optional` **cluster\_arn**: `string`

AWS ARN identifier for the cluster

• **cluster\_name**: `string`

Name of the cluster

• `Optional` **cluster\_status**: `string`

Current status of the cluster

• **region**: `string`

Reference to the associated region
