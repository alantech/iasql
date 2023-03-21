---
id: "aws_vpc_entity_elastic_ip.ElasticIp"
title: "elastic_ip"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Elastic IP addresses.
An Elastic IP address is a static IPv4 address designed for dynamic cloud computing. An Elastic IP address is allocated to your AWS account, and is yours until you release it.

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html

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
