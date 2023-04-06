---
id: "aws_route53_entity_alias_target.AliasTarget"
title: "alias_target"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Route 53 alias target:  Information about the AWS resource, such as a CloudFront
distribution or an Amazon S3 bucket, that you want to route traffic to.

**`See`**

https://docs.aws.amazon.com/Route53/latest/APIReference/API_AliasTarget.html

## Columns

• **evaluate\_target\_health**: `boolean`

Applies only to alias, failover alias, geolocation alias, latency alias, and weighted alias resource record sets:
When EvaluateTargetHealth is true, an alias resource record set inherits the health of the referenced AWS resource,
such as an ELB load balancer or another resource record set in the hosted zone.

**`See`**

https://docs.aws.amazon.com/Route53/latest/APIReference/API_AliasTarget.html

• `Optional` **load\_balancer**: [`load_balancer`](aws_elb_entity_load_balancer.LoadBalancer.md)

Reference to the load balancer where the alias target is pointing
