---
id: "aws_vpc_entity_internet_gateway.InternetGateway"
title: "Table: internet_gateway"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS Internet Gateway.
An internet gateway is a horizontally scaled, redundant, and highly available VPC component that enables communication between your VPC and the internet.

**`Example`**

```sql TheButton[Creates a Route table]="Creates a Route table"
INSERT INTO internet_gateway (tags, region) VALUES
('{"name":"internet_gateway"}', 'us-east-1');
```

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
