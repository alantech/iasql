---
id: "aws_vpc_entity_elastic_ip.ElasticIp"
title: "Table: elastic_ip"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS Elastic IP addresses.
An Elastic IP address is a static IPv4 address designed for dynamic cloud computing. An Elastic IP address is allocated to your AWS account, and is yours until you release it.

**`Example`**

```sql TheButton[Manage an Elastic IP]="Manage an Elastic IP"
INSERT INTO elastic_ip (tags) VALUES ('{"name": "test_eip"}');
SELECT * FROM elastic_ip WHERE tags ->> 'name' = 'test_eip';
DELETE FROM elastic_ip WHERE tags ->> 'name' = 'test_eip';
```

**`See`**

 - https://github.com/iasql/iasql/blob/main/test/modules/aws-vpc-eip-nat-integration.ts#L181L182
 - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html

## Columns

• `Optional` **allocation\_id**: `string`

AWS ID to identify the elastic IP

• `Optional` **public\_ip**: `string`

Reserved public IP address

• **region**: `string`

Reference to the region where it belongs

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the instance

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html

#### Type definition

▪ [key: `string`]: `string`
