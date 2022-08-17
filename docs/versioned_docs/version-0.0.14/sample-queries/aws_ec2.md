---
sidebar_position: 4
slug: '/aws_ec2'
---

# AWS EC2

## Create and update instances

Install the AWS EC2 module

```sql
SELECT * FROM iasql_install('aws_ec2');
```

Create two new EC2 instances associated with the `default` security group within a transaction. A instance `name` tag is required. `resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id` resolves to the AMI ID for Ubuntu in the corresponding AWS region.

```sql
BEGIN;
  INSERT INTO instance (ami, instance_type, tags)
    VALUES ('resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id', 't2.micro', '{"name":"i-1"}');
  INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
    (SELECT id FROM instance WHERE tags ->> 'name' = 'i-1'),
    (SELECT id FROM security_group WHERE group_name='default');
COMMIT;

BEGIN;
  INSERT INTO instance (ami, instance_type, tags)
    VALUES ('resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id', 't2.micro', '{"name":"i-2"}');
  INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
    (SELECT id FROM instance WHERE tags ->> 'name' = 'i-2'),
    (SELECT id FROM security_group WHERE group_name='default');
COMMIT;
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/Create%20EC2%20Instances/SELECT%20%2A%20FROM%20iasql_install%28%27aws_ec2%27%29%3B%0A%0ABEGIN%3B%0A%20%20INSERT%20INTO%20instance%20%28ami%2C%20instance_type%2C%20tags%29%0A%20%20%20%20VALUES%20%28%27resolve%3Assm%3A%2Faws%2Fservice%2Fcanonical%2Fubuntu%2Fserver%2F20.04%2Fstable%2Fcurrent%2Famd64%2Fhvm%2Febs-gp2%2Fami-id%27%2C%20%27t2.micro%27%2C%20%27%7B%22name%22%3A%22i-1%22%7D%27%29%3B%0A%20%20INSERT%20INTO%20instance_security_groups%20%28instance_id%2C%20security_group_id%29%20SELECT%0A%20%20%20%20%28SELECT%20id%20FROM%20instance%20WHERE%20tags%20-%3E%3E%20%27name%27%20%3D%20%27i-1%27%29%2C%0A%20%20%20%20%28SELECT%20id%20FROM%20security_group%20WHERE%20group_name%3D%27default%27%29%3B%0ACOMMIT%3B%0A%0ABEGIN%3B%0A%20%20INSERT%20INTO%20instance%20%28ami%2C%20instance_type%2C%20tags%29%0A%20%20%20%20VALUES%20%28%27resolve%3Assm%3A%2Faws%2Fservice%2Fcanonical%2Fubuntu%2Fserver%2F20.04%2Fstable%2Fcurrent%2Famd64%2Fhvm%2Febs-gp2%2Fami-id%27%2C%20%27t2.micro%27%2C%20%27%7B%22name%22%3A%22i-2%22%7D%27%29%3B%0A%20%20INSERT%20INTO%20instance_security_groups%20%28instance_id%2C%20security_group_id%29%20SELECT%0A%20%20%20%20%28SELECT%20id%20FROM%20instance%20WHERE%20tags%20-%3E%3E%20%27name%27%20%3D%20%27i-2%27%29%2C%0A%20%20%20%20%28SELECT%20id%20FROM%20security_group%20WHERE%20group_name%3D%27default%27%29%3B%0ACOMMIT%3B%0A%0ASELECT%20%2A%20FROM%20iasql_apply%28%29%3B', '_blank')}
>
Run SQL
</button>

Apply changes

```sql
SELECT * FROM iasql_apply();
```

Query newly created instances. View the table schema [here](https://dbdocs.io/iasql/iasql?table=instance&schema=public&view=table_structure)

```sql
SELECT *
FROM instance
WHERE tags ->> 'name' = 'i-1' OR
tags ->> 'name' = 'i-2';
```

Get an instance count

```sql
SELECT COUNT(*)
FROM instance;
```

Change the instance to the AWS Linux AMI for the previously created `i-1` instance. This will trigger a recreate so the existing instance will be terminated and a new one will be created when `iasql_apply` is called.

```sql
UPDATE instance SET ami = 'resolve:ssm:/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2' WHERE tags ->> 'name' = 'i-1';
SELECT * FROM iasql_apply();
```

## Read-only instance metadata

Install the AWS EC2 module

```sql
SELECT * FROM iasql_install('aws_ec2_metadata');
```

View the metadata for the previously created `i-1` instance. View the table schema [here](https://dbdocs.io/iasql/iasql?table=instance_metadata&schema=public&view=table_structure)

```sql
SELECT *
FROM instance_metadata
WHERE instance_id = (
  SELECT instance_id
  FROM instance
  WHERE tags ->> 'name' = 'i-1'
);
```