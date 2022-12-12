---
id: "aws_elb_entity_target_group.TargetGroup"
title: "Table: target_group"
sidebar_label: "target_group"
custom_edit_url: null
---

Table to manage AWS Target groups

**`Example`**

```sql
INSERT INTO target_group (target_group_name, target_type, protocol, port, vpc, health_check_path)
VALUES ('tg_name', 'ip', 'HTTP', 5678, null, '/health');
SELECT * FROM target_group WHERE target_group_name = 'tg_name';
DELETE FROM target_group WHERE target_group_name = 'tg_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-elb-integration.ts#L126
 - https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html

## Columns

• `Optional` **health\_check\_enabled**: `boolean`

Whether to enable healthchecks for this target group

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html

___

• `Optional` **health\_check\_interval\_seconds**: `number`

The approximate amount of time, in seconds, between health checks of an individual target.
The range is 5–300 seconds. The default is 30 seconds if the target type is instance or ip and 35
seconds if the target type is lambda.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html

___

• `Optional` **health\_check\_path**: `string`

The destination for health checks on the targets.
If the protocol version is HTTP/1.1 or HTTP/2, specify a valid URI (/path?query). The default is /.
If the protocol version is gRPC, specify the path of a custom health check method with the format /package.service/method.
The default is /AWS.ALB/healthcheck.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html

___

• `Optional` **health\_check\_port**: `string`

The port the load balancer uses when performing health checks on targets. The default is to use the port
on which each target receives traffic from the load balancer.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html

___

• `Optional` **health\_check\_protocol**: [`protocol`](../enums/aws_elb_entity_target_group.ProtocolEnum.md)

The protocol the load balancer uses when performing health checks on targets.
The possible protocols are HTTP and HTTPS. The default is the HTTP protocol.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html

___

• `Optional` **health\_check\_timeout\_seconds**: `number`

The amount of time, in seconds, during which no response from a target means a failed health check.
The range is 2–120 seconds. The default is 5 seconds if the target type is instance or ip and
30 seconds if the target type is lambda.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html

___

• `Optional` **healthy\_threshold\_count**: `number`

The number of consecutive successful health checks required before considering an unhealthy target healthy.
The range is 2–10. The default is 5.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html

___

• `Optional` **ip\_address\_type**: [`target_group_ip_address_type`](../enums/aws_elb_entity_target_group.TargetGroupIpAddressTypeEnum.md)

Whether to expose ipv4 or ipv6

___

• `Optional` **port**: `number`

Port to expose

___

• `Optional` **protocol**: [`protocol`](../enums/aws_elb_entity_target_group.ProtocolEnum.md)

Protocol for the target group

___

• `Optional` **protocol\_version**: [`protocol_version`](../enums/aws_elb_entity_target_group.ProtocolVersionEnum.md)

Protocol version for the target group

___

• **region**: `string`

Region for the target group

___

• `Optional` **target\_group\_arn**: `string`

AWS ARN to identify the target group

___

• **target\_group\_name**: `string`

Name to identify the target group

___

• **target\_type**: [`target_type`](../enums/aws_elb_entity_target_group.TargetTypeEnum.md)

Type of target group to create

___

• `Optional` **unhealthy\_threshold\_count**: `number`

The number of consecutive failed health checks required before considering a target unhealthy.
The range is 2–10. The default is 2.

**`See`**

https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html

___

• `Optional` **vpc**: [`vpc`](aws_vpc_entity_vpc.Vpc.md)

Reference to the associated VPC
If the target is a Lambda function, this parameter does not apply. Otherwise, this parameter is required.
