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

```sql
INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
SELECT true, 'tcp', 443, 443, '0.0.0.0/8', 'iasqlsamplerule', id
FROM security_group
WHERE group_name = 'iasql-sample-sg';

INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv6, description, security_group_id)
SELECT false, 'tcp', 22, 22, '::/8', 'iasqlsamplerule2', id
FROM security_group
WHERE group_name = 'iasql-sample-sg';
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/SELECT%20%2A%20FROM%20iasql_install%28%27aws_security_group%27%29%3B%0A%0AINSERT%20INTO%20security_group%20%28description%2C%20group_name%29%0AVALUES%20%28%27Security%20Group%20from%20IaSQL%20sample%27%2C%20%27iasql-sample-sg%27%29%3B%0A%0AINSERT%20INTO%20security_group_rule%20%28is_egress%2C%20ip_protocol%2C%20from_port%2C%20to_port%2C%20cidr_ipv4%2C%20description%2C%20security_group_id%29%0ASELECT%20true%2C%20%27tcp%27%2C%20443%2C%20443%2C%20%270.0.0.0%2F8%27%2C%20%27iasqlsamplerule%27%2C%20id%0AFROM%20security_group%0AWHERE%20group_name%20%3D%20%27iasql-sample-sg%27%3B%0A%0AINSERT%20INTO%20security_group_rule%20%28is_egress%2C%20ip_protocol%2C%20from_port%2C%20to_port%2C%20cidr_ipv6%2C%20description%2C%20security_group_id%29%0ASELECT%20false%2C%20%27tcp%27%2C%2022%2C%2022%2C%20%27%3A%3A%2F8%27%2C%20%27iasqlsamplerule2%27%2C%20id%0AFROM%20security_group%0AWHERE%20group_name%20%3D%20%27iasql-sample-sg%27%3B%0A%0ASELECT%20%2A%20FROM%20iasql_apply%28%29%3B', '_blank')}
>
Run SQL
</button>