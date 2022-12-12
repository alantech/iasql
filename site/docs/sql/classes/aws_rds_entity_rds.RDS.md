---
id: "aws_rds_entity_rds.RDS"
title: "Table: RDS"
sidebar_label: "RDS"
custom_edit_url: null
---

Table to manage AWS RDS instances

**`Example`**

```sql
INSERT INTO rds (db_instance_identifier, allocated_storage, db_instance_class, master_username, master_user_password, availability_zone, engine, backup_retention_period)
VALUES ('db_name', 20, 'db.t3.micro', 'test', 'testpass', (SELECT name FROM availability_zone WHERE region = 'us-east-1' LIMIT 1), 'postgres:13.4', 0);
SELECT * FROM rds WHERE db_instance_identifier = 'db_name';
DELETE FROM rds WHERE db_instance_identifier = 'db_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-rds-integration.ts#L93
 - https://aws.amazon.com/rds/

## Columns

• **allocated\_storage**: `number`

Amount of storage requested for the database

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#allocatedstorage
TODO: Add constraints? range vary based on storage type and engine

___

• **availability\_zone**: [`availability_zone`](aws_vpc_entity_availability_zone.AvailabilityZone.md)

Reference to the availability zones for the database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html

___

• **backup\_retention\_period**: `number`

Limit of days for keeping a database backup

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html#USER_WorkingWithAutomatedBackups.Enabling

___

• **db\_instance\_class**: `string`

Class that represents the computation and memory capacity of an Amazon RDS DB instance

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html#Concepts.DBInstanceClass.Types

TODO: make this an entity eventually?

___

• **db\_instance\_identifier**: `string`

Name for the databae

___

• `Optional` **endpoint\_addr**: `string`

Address used to connect to the RDS database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_Endpoint.html
TODO: make this an entity eventually?

___

• `Optional` **endpoint\_hosted\_zone\_id**: `string`

Hosted zone ID used to connect to the RDS database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_Endpoint.html
TODO: make this an entity eventually?

___

• `Optional` **endpoint\_port**: `number`

Port used to connect to the RDS database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_Endpoint.html
TODO: make this an entity eventually?

___

• **engine**: `string`

Engine to use for the current database

**`See`**

https://docs.aws.amazon.com/cli/latest/reference/rds/describe-db-engine-versions.html

___

• `Optional` **master\_user\_password**: `string`

Master user password for the database

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masteruserpassword
How to handle this? It is used just for creation and if an update is needed. After creation / update the value is removed from db
TODO: Apply constraints?

___

• `Optional` **master\_username**: `string`

Master username for the database

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-rds/interfaces/createdbinstancecommandinput.html#masterusername
TODO: Apply constraints?

___

• `Optional` **parameter\_group**: [`parameter_group`](aws_rds_entity_parameter_group.ParameterGroup.md)

List of the parameter groups associated with the database

___

• **region**: `string`

Region for the database

___

• **vpc\_security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to the VPC security groups for the database

**`See`**

https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html
TODO rename table
