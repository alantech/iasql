---
sidebar_position: 5
slug: '/aws_rds'
---

# AWS RDS

## Create a DB instance

Install the AWS RDS module

```sql
SELECT * FROM iasql_install('aws_rds');
```

Create a DB instance in the [rds](https://dbdocs.io/iasql/iasql?table=rds&schema=public&view=table_structure) table, associate the default security group to it, and apply the changes to the cloud account

```sql TheButton
INSERT INTO rds (db_instance_identifier, allocated_storage, db_instance_class, master_username, master_user_password,
                 availability_zone, engine, backup_retention_period)
VALUES ('iasqlsample', 20, 'db.t3.micro', 'test', 'testpass', (select * from availability_zone limit 1),
        'postgres:13.4', 0);

INSERT INTO rds_security_groups (rds_id, security_group_id)
SELECT (SELECT id FROM rds WHERE db_instance_identifier = 'iasqlsample'),
       (SELECT id FROM security_group WHERE group_name = 'default');
```
