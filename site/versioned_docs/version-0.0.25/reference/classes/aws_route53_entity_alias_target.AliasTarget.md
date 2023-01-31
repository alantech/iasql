---
id: "aws_route53_entity_alias_target.AliasTarget"
title: "Table: alias_target"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS Route 53 alias target:  Information about the AWS resource, such as a CloudFront
distribution or an Amazon S3 bucket, that you want to route traffic to.

**`Example`**

```sql TheButton[Add an Alias Target]="Add an Alias target"
INSERT INTO alias_target (load_balancer_id) VALUES ((SELECT id FROM load_balancer WHERE load_balancer_name = 'lb_name'));
```

**`See`**

 - https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-route53-integration.ts#L343
 - https://docs.aws.amazon.com/Route53/latest/APIReference/API_AliasTarget.html

## Columns

• **evaluate\_target\_health**: `boolean`

Applies only to alias, failover alias, geolocation alias, latency alias, and weighted alias resource record sets:
When EvaluateTargetHealth is true, an alias resource record set inherits the health of the referenced AWS resource,
such as an ELB load balancer or another resource record set in the hosted zone.

**`See`**

https://docs.aws.amazon.com/Route53/latest/APIReference/API_AliasTarget.html

• `Optional` **load\_balancer**: [`load_balancer`](aws_elb_entity_load_balancer.LoadBalancer.md)

Reference to the load balancer where the alias target is pointing
