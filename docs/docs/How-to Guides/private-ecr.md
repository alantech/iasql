---
sidebar_position: 4
slug: '/private-ecr'
---

If you are creating an ECS task that is hosted on AWS Fargate, or on an external instance, and is pulling a container image from an Amazon ECR private repository you will need to have a ECS execution role.

Follow these instructions to create one: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html

Once you create the role, use it to create the ECS task definition via the `create_task_definition` stored procedure.