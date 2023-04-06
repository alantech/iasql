---
id: "aws_elb_entity_load_balancer.LoadBalancer"
title: "load_balancer"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Load Balancers. Elastic Load Balancing automatically distributes your incoming traffic across multiple targets,
such as EC2 instances, containers, and IP addresses, in one or more Availability Zones.

A load balancer serves as the single point of contact for clients. The load balancer distributes incoming application traffic across
multiple targets, such as EC2 instances, in multiple Availability Zones. This increases the availability of your application.

You add one or more listeners to your load balancer.

**`See`**

https://aws.amazon.com/elasticloadbalancing/

## Columns

• `Optional` **attributes**: `load_balancer_attribute`[]

• `Optional` **availability\_zones**: `string`[]

Reference to the associated availability zones for the load balancer

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/enable-disable-az.html

• `Optional` **canonical\_hosted\_zone\_id**: `string`

Hosted zone to route traffic to the load balancer

**`See`**

https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-elb-load-balancer.html

• `Optional` **created\_time**: `date`

Creation date

• `Optional` **customer\_owned\_ipv4\_pool**: `string`

Reference to an specific pool of address for ipv4

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_LoadBalancer.html

• `Optional` **dns\_name**: `string`

Custom domain name to associate with your load balancer.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/using-domain-names-with-elb.html

• **ip\_address\_type**: [`ip_address_type`](../enums/aws_elb_entity_load_balancer.IpAddressType.md)

Whether to expose ipv4 or dual stack

• `Optional` **load\_balancer\_arn**: `string`

AWS ARN that identifies the load balancer

• **load\_balancer\_name**: `string`

Name to identify the load balancer

• **load\_balancer\_type**: [`load_balancer_type`](../enums/aws_elb_entity_load_balancer.LoadBalancerTypeEnum.md)

Type of load balancer

• **region**: `string`

Region for the load balancer

• **scheme**: [`load_balancer_scheme`](../enums/aws_elb_entity_load_balancer.LoadBalancerSchemeEnum.md)

Schema for the load balancer

• `Optional` **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to the associated security groups for the load balancer

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-update-security-groups.html

• `Optional` **state**: [`load_balancer_state`](../enums/aws_elb_entity_load_balancer.LoadBalancerStateEnum.md)

Current status of the load balancer

• `Optional` **subnets**: `string`[]

Reference to the associated subnets for a load balancer

**`See`**

https://docs.aws.amazon.com/prescriptive-guidance/latest/load-balancer-stickiness/subnets-routing.html

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated with the load balancer

**`See`**

https://aws.amazon.com/blogs/aws/new-aws-elastic-load-balancing-inside-of-a-virtual-private-cloud/
