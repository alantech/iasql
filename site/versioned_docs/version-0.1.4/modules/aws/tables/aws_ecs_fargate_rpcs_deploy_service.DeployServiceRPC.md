---
id: "aws_ecs_fargate_rpcs_deploy_service.DeployServiceRPC"
title: "deploy_service"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to deploy a service using ECS fargate

Returns following columns:
- arn: AWS ARN for the deployed service
- status: OK if the deployment succeeded
- message: The error message in case of errors

Accepts the following parameters:
- arn: AWS ARN for the service to deploy

**`See`**

https://aws.amazon.com/es/blogs/compute/building-deploying-and-operating-containerized-applications-with-aws-fargate/
