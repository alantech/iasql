---
id: "aws_elb_entity_listener.Listener"
title: "listener"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS Load Balancer listeners. Before you start using your Application Load Balancer, you must add one or more listeners.
A listener is a process that checks for connection requests, using the protocol and port that you configure.
The rules that you define for a listener determine how the load balancer routes requests to its registered targets.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html

## Columns

• **action\_type**: [`FORWARD`](../enums/aws_elb_entity_listener.ActionTypeEnum.md#forward)

Action type for this specific listener

• `Optional` **certificate**: [`certificate`](aws_acm_entity_certificate.Certificate.md)

Reference to the certificate used by the listener when exposing HTTPs ports

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html

• `Optional` **listener\_arn**: `string`

AWS ARN that identifies the listener

• **load\_balancer**: [`load_balancer`](aws_elb_entity_load_balancer.LoadBalancer.md)

Reference to the load balancer associated to this listener

• **port**: `number`

Port exposed at the listener

• **protocol**: [`protocol`](../enums/aws_elb_entity_target_group.ProtocolEnum.md)

Protocol for the exposed port

• `Optional` **ssl\_policy**: `string`

Type of SSL policy to use

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html#describe-ssl-policies

• **target\_group**: [`target_group`](aws_elb_entity_target_group.TargetGroup.md)

Reference to the target group associated with this listener
