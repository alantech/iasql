---
id: "aws_rds_entity_rds.RDS"
title: "Table: RDS"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS RDS instances. Amazon Relational Database Service (Amazon RDS) is a web service that makes it easier to
set up, operate, and scale a relational database in the AWS Cloud.

It provides cost-efficient, resizable capacity for an industry-standard relational database and manages common database administration tasks.

**`Example`**

```sql TheButton[Manage an RDS instance]="Manage an RDS instance"
INSERT INTO rds (db_instance_identifier, allocated_storage, db_instance_class, master_username, master_user_password, availability_zone, engine, backup_retention_period)
VALUES ('db_name', 20, 'db.t3.micro', 'test', 'testpass', (SELECT name FROM availability_zone WHERE region = 'us-east-1' LIMIT 1), 'postgres:13.4', 0);
SELECT * FROM rds WHERE db_instance_identifier = 'db_name';
DELETE FROM rds WHERE db_instance_identifier = 'db_name';
```

**`See`**

 - https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-rds-integration.ts#L93
 - https://aws.amazon.com/rds/

## Columns

• **allocated\_storage**: `number`

Amount of storage requested for the database

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#allocatedstorage

• **availability\_zone**: [`availability_zone`](aws_vpc_entity_availability_zone.AvailabilityZone.md)

Reference to the availability zones for the database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html

• **backup\_retention\_period**: `number`

Limit of days for keeping a database backup

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html#USER_WorkingWithAutomatedBackups.Enabling

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

• **vpc\_security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to the VPC security groups for the database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html
