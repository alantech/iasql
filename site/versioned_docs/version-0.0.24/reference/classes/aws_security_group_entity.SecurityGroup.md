---
id: "aws_security_group_entity.SecurityGroup"
title: "Table: security_group"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS security groups.
A security group controls the traffic that is allowed to reach and leave the resources that it is associated with.

**`Example`**

```sql TheButton[Manage a Security group]="Manage a Security group"
INSERT INTO security_group (description, group_name) VALUES ('sg description', 'sg_name');
SELECT * FROM security_group WHERE group_name = 'sg_name';
DELETE FROM security_group WHERE group_name = 'sg_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-security-group-integration.ts#L122
 - https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html

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
