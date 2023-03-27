---
id: "aws_rds_entity_db_cluster.DBCluster"
title: "db_cluster"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage Multi-AZ DB cluster instances. A Multi-AZ DB cluster deployment is a high availability
deployment mode of Amazon RDS with two readable standby DB instances. A Multi-AZ DB cluster has a writer
DB instance and two reader DB instances in three separate Availability Zones in the same AWS Region.
Multi-AZ DB clusters provide high availability, increased capacity for read workloads,
and lower write latency when compared to Multi-AZ DB instance deployments.

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/multi-az-db-clusters-concepts.html

## Columns

• **allocated\_storage**: `number`

The amount of storage in gibibytes (GiB) to allocate to each DB instance in the Multi-AZ DB cluster.

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html#USER_PIOPS

• `Optional` **arn**: `string`

ARN for the generated db cluster

• `Optional` **backup\_retention\_period**: `number`

The number of days for which automated backups are retained.

• **db\_cluster\_identifier**: `string`

Name for the databae

• **db\_cluster\_instance\_class**: `string`

The compute and memory capacity of each DB instance in the Multi-AZ DB cluster.
Valid only for multi-az clusters.

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html

• **deletion\_protection**: `boolean`

A value that indicates whether the DB cluster has deletion protection enabled.

• `Optional` **engine**: [`db_cluster_engine`](../enums/aws_rds_entity_db_cluster.dbClusterEngineEnum.md)

The name of the database engine to be used for this DB cluster.

• `Optional` **engine\_version**: `string`

The version number of the database engine to use.

• **iops**: `number`

The number of I/O operations per second (IOPS)

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Storage.html#USER_PIOPS

• `Optional` **master\_user\_password**: `string`

The password for the master database user.

• **master\_username**: `string`

The name of the master user for the DB cluster.

• `Optional` **port**: `number`

The port number on which the instances in the DB cluster accept connections.

• **publicly\_accessible**: `boolean`

A value that indicates whether the DB cluster is publicly accessible.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbclustercommandinput.html#publiclyaccessible

• **region**: `string`

Region for the cluster. Support for multi-az clusters may be limited on different regions.
Please check AWS documentation for more details.

• **storage\_encrypted**: `boolean`

A value that indicates whether the DB cluster is encrypted.

• **subnet\_group**: [`db_subnet_group`](aws_rds_entity_db_subnet_group.DBSubnetGroup.md)

Reference to the subnet groups associated with the cluster

• `Optional` **tags**: `Object`

Complex type to provide identifier tags

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/tag.html

#### Type definition

▪ [key: `string`]: `string`

• **vpc\_security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to the VPC security groups for the database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html
