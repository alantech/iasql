---
id: "aws_ecs_fargate_rpcs_deploy_service.DeployServiceRPC"
title: "Table: deploy_service"
sidebar_label: "deploy_service"
custom_edit_url: null
---

Method to deploy a service using ECS fargate

Returns following columns:
- arn: AWS ARN for the deployed service
- status: OK if the deployment succeeded
- message: The error message in case of errors

Accepts the following parameters:
- arn: AWS ARN for the service to deploy

**`Example`**

```sql
SELECT deploy_service(arn) FROM service WHERE name='service_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecs-integration.ts#L686
 - https://aws.amazon.com/es/blogs/compute/building-deploying-and-operating-containerized-applications-with-aws-fargate/

## Columns
