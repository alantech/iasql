---
id: "aws_security_group_entity.SecurityGroup"
title: "security_group"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS security groups.
A security group controls the traffic that is allowed to reach and leave the resources that it is associated with.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html

## Columns

• `Optional` **description**: `string`

Description for the security group

• `Optional` **group\_id**: `string`

AWS ID to identify the security group

• **group\_name**: `string`

Name for the security group

• `Optional` **owner\_id**: `string`

The Amazon Web Services account ID of the owner of the security group.

• **region**: `string`

Region for the security group

• **security\_group\_rules**: [`security_group_rule`](aws_security_group_entity.SecurityGroupRule.md)[]

List of rules associated to this security group

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference of the VPC associated to this security group

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html
