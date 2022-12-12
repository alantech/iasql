---
id: "aws_ecs_fargate_entity_service.Service"
title: "Table: service"
sidebar_label: "service"
custom_edit_url: null
---

Table to manage AWS ECS services.

**`Example`**

```sql
INSERT INTO service ("name", desired_count, subnets, assign_public_ip, cluster_id, task_definition_id, target_group_id)
VALUES ('service_name', 1, (select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true and vpc.region = 'us-east-1' limit 3)),
'ENABLED', (SELECT id FROM cluster WHERE cluster_name = '${clusterName}'), (select id from task_definition where family = 'task-definition' and region = 'us-east-1'
order by revision desc limit 1), (SELECT id FROM target_group WHERE target_group_name = 'target-group' and region = 'us-east-1'));
SELECT * FROM service WHERE name = 'service-name';
delete from service where name = 'service-name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L516
 - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html

## Columns

• `Optional` **arn**: `string`

AWS ARN for the service

___

• **assign\_public\_ip**: [`assign_public_ip`](../enums/aws_ecs_fargate_entity_service.AssignPublicIp.md)

Whether to assign a public IP to the service

___

• `Optional` **cluster**: [`cluster`](aws_ecs_fargate_entity_cluster.Cluster.md)

Reference to the cluster where the service belongs to

___

• `Optional` **desired\_count**: `number`

The desired number of instantiations of the task definition to keep running on the service.

___

• **name**: `string`

Name of the container definition

___

• **region**: `string`

Region for the ECS service

___

• **security\_groups**: [`security_group`](aws_security_group_entity.SecurityGroup.md)[]

Reference to all the security groups used by the service

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/service.html#networkconfiguration

___

• `Optional` **status**: `string`

Current status of the service

___

• **subnets**: `string`[]

Ids of all the VPC subnets used by the service

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ecs/interfaces/service.html#networkconfiguration

___

• `Optional` **target\_group**: [`target_group`](aws_elb_entity_target_group.TargetGroup.md)

Reference of the target group that will be associated with the service, to expose it via load balancers

**`See`**

https://docs.aws.amazon.com/AmazonECS/latest/developerguide/register-multiple-targetgroups.html

___

• `Optional` **task**: [`task_definition`](aws_ecs_fargate_entity_task_definition.TaskDefinition.md)

Reference to the task definition that uses the service
