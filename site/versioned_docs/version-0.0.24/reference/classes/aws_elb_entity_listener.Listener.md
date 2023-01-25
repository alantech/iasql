---
id: "aws_elb_entity_listener.Listener"
title: "Table: listener"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS Load Balancer listeners. Before you start using your Application Load Balancer, you must add one or more listeners.
A listener is a process that checks for connection requests, using the protocol and port that you configure.
The rules that you define for a listener determine how the load balancer routes requests to its registered targets.

**`Example`**

```sql TheButton[Manage an Load Balancer listener]="Manage a Load Balancer listener"
INSERT INTO listener (load_balancer_id, port, protocol, target_group_id) VALUES
((SELECT id FROM load_balancer WHERE load_balancer_name = 'lb_name'), 5678, 'tcp',
(SELECT id FROM target_group WHERE target_group_name = 'target_group_name'));

DELETE FROM listener WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = 'lb_name');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-elb-integration.ts#L400
 - https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html

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
