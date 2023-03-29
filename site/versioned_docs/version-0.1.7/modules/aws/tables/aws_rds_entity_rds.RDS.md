---
id: "aws_rds_entity_rds.RDS"
title: "RDS"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS RDS instances. Amazon Relational Database Service (Amazon RDS) is a web service that makes it easier to
set up, operate, and scale a relational database in the AWS Cloud.

It provides cost-efficient, resizable capacity for an industry-standard relational database and manages common database administration tasks.

**`See`**

https://aws.amazon.com/rds/

## Columns

• **allocated\_storage**: `number`

Amount of storage requested for the database

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#allocatedstorage

• `Optional` **arn**: `string`

ARN for the generated db instance

• **availability\_zone**: [`availability_zone`](aws_vpc_entity_availability_zone.AvailabilityZone.md)

Reference to the availability zones for the database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html

• **backup\_retention\_period**: `number`

Limit of days for keeping a database backup

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html#USER_WorkingWithAutomatedBackups.Enabling

• `Optional` **db\_cluster**: [`db_cluster`](aws_rds_entity_db_cluster.DBCluster.md)

DB cluster associated to the DB instance

• **db\_instance\_class**: `string`

Class that represents the computation and memory capacity of an Amazon RDS DB instance

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html#Concepts.DBInstanceClass.Types

• **db\_instance\_identifier**: `string`

Name for the databae

• `Optional` **endpoint\_addr**: `string`

Address used to connect to the RDS database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_Endpoint.html

• `Optional` **endpoint\_hosted\_zone\_id**: `string`

Hosted zone ID used to connect to the RDS database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_Endpoint.html

• `Optional` **endpoint\_port**: `number`

Port used to connect to the RDS database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_Endpoint.html

• **engine**: `string`

Engine to use for the current database

**`See`**

https://docs.aws.amazon.com/cli/latest/reference/rds/describe-db-engine-versions.html

• `Optional` **engine\_version**: `string`

The version number of the database engine to use.

• `Optional` **master\_user\_password**: `string`

Master user password for the database

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masteruserpassword

• `Optional` **master\_username**: `string`

Master username for the database

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masterusername

• `Optional` **parameter\_group**: [`parameter_group`](aws_rds_entity_parameter_group.ParameterGroup.md)

List of the parameter groups associated with the database

• **region**: `string`

Region for the database

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the volume

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/tag.html

#### Type definition

▪ [key: `string`]: `string`

• **vpc\_security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to the VPC security groups for the database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html
