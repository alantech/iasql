---
id: "aws_security_group_entity.SecurityGroupRule"
title: "security_group_rule"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS security group rules. The rules of a security group control the inbound traffic that's allowed to reach the
instances that are associated with the security group. The rules also control the outbound traffic that's allowed to leave them.

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules.html

## Columns

• `Optional` **cidr\_ipv4**: `string`

IPV4 CIDR referenced by this rule

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html

• `Optional` **cidr\_ipv6**: `string`

IPV6 CIDR referenced by this rule

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html

• `Optional` **description**: `string`

Description for the security group rule

• `Optional` **from\_port**: `number`

Initial port to allow for an specific range. Minimum is 0

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html

• `Optional` **ip\_protocol**: `string`

The protocol to allow. The most common protocols are 'tcp', 'udp' and 'icmp'

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html

• **is\_egress**: `boolean`

If true, represents a rule for outbound traffic

• `Optional` **prefix\_list\_id**: `string`

Reference for the rule prefix list. A managed prefix list is a set of one or more CIDR blocks.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/managed-prefix-lists.html

• **region**: `string`

Region for the security group rule

• **security\_group**: [`security_group`](aws_security_group_entity.SecurityGroup.md)

Reference for the security group associated to this rule

• `Optional` **security\_group\_rule\_id**: `string`

AWS ID representing the security group rule

• `Optional` **source\_security\_group**: [`security_group`](aws_security_group_entity.SecurityGroup.md)

Reference for the source security group associated to the rule.
By specifying a VPC security group as the source, you allow incoming traffic from all instances (typically application servers) that use the source VPC security group.

**`See`**

https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html

• `Optional` **to\_port**: `number`

Final port to allow for an specific range. Maximum is 65535

**`See`**

https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html
