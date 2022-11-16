---
sidebar_position: 2
slug: '/aws_security_group'
---

# AWS Security Group

## Create a security group

Install the AWS security group module

```sql
SELECT * FROM iasql_install('aws_security_group');
```

An AWS `security_group` controls the traffic that is allowed to reach and leave the cloud resources that it is associated with via `security_group_rules`.

```sql
INSERT INTO security_group (description, group_name)
VALUES ('Security Group from IaSQL sample', 'iasql-sample-sg');
```

Now create two security group rules to allow SSH (port 22) and HTTPS (port 443) and associate them with the security group created above using a foreign key relationship. Read more about security group rule configuration [here](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html#SecurityGroupRules)

```sql TheButton
INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
SELECT true, 'tcp', 443, 443, '0.0.0.0/8', 'iasqlsamplerule', id
FROM security_group
WHERE group_name = 'iasql-sample-sg';

INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
SELECT false, 'tcp', 22, 22, '0.0.0.0/0', 'iasqlsamplerule2', id
FROM security_group
WHERE group_name = 'iasql-sample-sg';
```
