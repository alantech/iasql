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

```sql
INSERT INTO rds (db_instance_identifier, allocated_storage, db_instance_class, master_username, master_user_password, availability_zone, engine, backup_retention_period)
  VALUES ('iasqlsample', 20, 'db.t3.micro', 'test', 'testpass', (select * from availability_zone limit 1), 'postgres:14.4', 0);

INSERT INTO rds_security_groups (rds_id, security_group_id) SELECT
  (SELECT id FROM rds WHERE db_instance_identifier='iasqlsample'),
  (SELECT id FROM security_group WHERE group_name='default');

SELECT * FROM iasql_apply();
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/INSERT%20INTO%20rds%20%28db_instance_identifier%2C%20allocated_storage%2C%20db_instance_class%2C%20master_username%2C%20master_user_password%2C%20availability_zone%2C%20engine%2C%20backup_retention_period%29%0A%20%20VALUES%20%28%27iasqlsample%27%2C%2020%2C%20%27db.t3.micro%27%2C%20%27test%27%2C%20%27testpass%27%2C%20%28select%20%2A%20from%20availability_zone%20limit%201%29%2C%20%27postgres%3A14.4%27%2C%200%29%3B%0A%0AINSERT%20INTO%20rds_security_groups%20%28rds_id%2C%20security_group_id%29%20SELECT%0A%20%20%28SELECT%20id%20FROM%20rds%20WHERE%20db_instance_identifier%3D%27iasqlsample%27%29%2C%0A%20%20%28SELECT%20id%20FROM%20security_group%20WHERE%20group_name%3D%27default%27%29%3B%0A%0ASELECT%20%2A%20FROM%20iasql_preview_apply%28%29%3B', '_blank')}
>
Run SQL
</button>