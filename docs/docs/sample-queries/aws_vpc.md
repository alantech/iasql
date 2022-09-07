---
sidebar_position: 1
slug: '/vpc'
---

# AWS VPC

## Create a VPC and a subnet within it

Install the AWS virtual private cloud (VPC) module

```sql
SELECT * FROM iasql_install('aws_vpc');
```

Create an isolated VPC in which to create resources via the [`vpc`](https://dbdocs.io/iasql/iasql?table=vpc&schema=public&view=table_structure) table. Read more about VPC [here](https://docs.aws.amazon.com/vpc/latest/userguide/configure-your-vpc.html). To create a VPC, specify a range of IPv4 addresses for the VPC in the form of a Classless Inter-Domain Routing (CIDR) block.

```sql
INSERT INTO vpc (cidr_block)
VALUES ('192.168.0.0/16');
```

Now `apply` the VPC change to your cloud account

```sql
SELECT * FROM iasql_apply();
```

A VPC spans all of the Availability Zones in an AWS Region. After you create a VPC, you can add one or more subnets in each Availability Zone. The snippet below creates a non-default subnet in one of the availability zones within the newly created VPC

```sql
INSERT INTO subnet (availability_zone, vpc_id, cidr_block)
SELECT (SELECT * FROM availability_zone LIMIT 1), id, '192.168.0.0/16'
FROM vpc
WHERE is_default = false
AND cidr_block = '192.168.0.0/16';
```

<!--- https://www.urlencoder.org/ -->
<button
  className={"button button--primary button--lg margin-bottom--lg"}
  onClick={() => window.open('https://app.iasql.com/#/button/SELECT%20%2A%20FROM%20iasql_install%28%27aws_vpc%27%29%3B%0A%0AINSERT%20INTO%20vpc%20%28cidr_block%29%0AVALUES%20%28%27192.168.0.0%2F16%27%29%3B%0A%0ASELECT%20%2A%20FROM%20iasql_apply%28%29%3B%0A%0AINSERT%20INTO%20subnet%20%28availability_zone%2C%20vpc_id%2C%20cidr_block%29%0ASELECT%20%28select%20%2A%20from%20availability_zone%20limit%201%29%2C%20id%2C%20%27192.168.0.0%2F16%27%0AFROM%20vpc%0AWHERE%20is_default%20%3D%20false%0AAND%20cidr_block%20%3D%20%27192.168.0.0%2F16%27%3B%0A%0ASELECT%20%2A%20FROM%20iasql_apply%28%29%3B', '_blank')}
>
Run SQL
</button>