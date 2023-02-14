---
id: "aws_vpc_entity_internet_gateway.InternetGateway"
title: "internet_gateway"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Internet Gateway.
An internet gateway is a horizontally scaled, redundant, and highly available VPC component that enables communication between your VPC and the internet.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html

## Columns

• `Optional` **internet\_gateway\_id**: `string`

AWS-generated id for this internet gateway

• **region**: `string`

Reference to the region where it belongs

• `Optional` **tags**: `Object`

Complex type to provide identifier tags for the internet gateway

#### Type definition

▪ [key: `string`]: `string`

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated with this internet gateway
