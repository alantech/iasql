---
id: "aws_ec2_entity_registered_instance.RegisteredInstance"
title: "registered_instance"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to track the EC2 instances that are registered into load balancers

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/elb-deregister-register-instances.html

## Columns

• **instance**: [`instance`](aws_ec2_entity_instance.Instance.md)

Reference to the instance to associate with the specific load balancer

• `Optional` **port**: `number`

Port to expose in that association

• **region**: `string`

Region for the VM association

• **target\_group**: [`target_group`](aws_elb_entity_target_group.TargetGroup.md)

Reference to the target group for the association
