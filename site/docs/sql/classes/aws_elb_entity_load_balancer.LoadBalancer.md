---
id: "aws_elb_entity_load_balancer.LoadBalancer"
title: "Table: load_balancer"
sidebar_label: "load_balancer"
custom_edit_url: null
---

Table to manage AWS Load Balancers

**`Example`**

```sql
INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
VALUES ('load_balancer', 'internet-facing', null, 'application', 'ipv4');
SELECT * FROM load_balancer WHERE load_balancer_name = 'load_balancer';
DELETE FROM load_balancer WHERE load_balancer_name = 'load_balancer';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-elb-integration.ts#L221
 - https://aws.amazon.com/elasticloadbalancing/

## Columns

• `Optional` **attributes**: `load_balancer_attribute`[]

___

• `Optional` **availability\_zones**: `string`[]

Reference to the associated availability zones for the load balancer

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/enable-disable-az.html

___

• `Optional` **canonical\_hosted\_zone\_id**: `string`

Hosted zone to route traffic to the load balancer

**`See`**

https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-elb-load-balancer.html

___

• `Optional` **created\_time**: `date`

Creation date

___

• `Optional` **customer\_owned\_ipv4\_pool**: `string`

Reference to an specific pool of address for ipv4

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_LoadBalancer.html

___

• `Optional` **dns\_name**: `string`

Custom domain name to associate with your load balancer.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/using-domain-names-with-elb.html

___

• **ip\_address\_type**: [`ip_address_type`](../enums/aws_elb_entity_load_balancer.IpAddressType.md)

Whether to expose ipv4 or dual stack

___

• `Optional` **load\_balancer\_arn**: `string`

AWS ARN that identifies the load balancer

___

• **load\_balancer\_name**: `string`

Name to identify the load balancer

___

• **load\_balancer\_type**: [`load_balancer_type`](../enums/aws_elb_entity_load_balancer.LoadBalancerTypeEnum.md)

Type of load balancer

___

• **region**: `string`

Region for the load balancer

___

• **scheme**: [`load_balancer_scheme`](../enums/aws_elb_entity_load_balancer.LoadBalancerSchemeEnum.md)

Schema for the load balancer

___

• `Optional` **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to the associated security groups for the load balancer

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-update-security-groups.html

___

• `Optional` **state**: [`load_balancer_state`](../enums/aws_elb_entity_load_balancer.LoadBalancerStateEnum.md)

Current status of the load balancer

___

• `Optional` **subnets**: `string`[]

Reference to the associated subnets for a load balancer

**`See`**

https://docs.aws.amazon.com/prescriptive-guidance/latest/load-balancer-stickiness/subnets-routing.html

___

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the VPC associated with the load balancer

**`See`**

https://aws.amazon.com/blogs/aws/new-aws-elastic-load-balancing-inside-of-a-virtual-private-cloud/
