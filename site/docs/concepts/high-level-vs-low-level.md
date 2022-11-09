---
sidebar_position: 4
slug: '/high-level-vs-low-level'
---

# High-level vs Low-level IaSQL Modules

In IaSQL, you are able to do cloud actions both on a high-level and a low-level abstraction layer. It means that you can go with both of these two approaches:
1. Deploy the folder `examples/ecs-fargate/prisma/app` of the repo `https://github.com/iasql/iasql-engine/` to ECS on my AWS account
2. Create a security group named `allow-all` attached to the VPC with ID `vpc-f56cff91`. Then add a rule to it allowing all incoming traffic on port `80` from `0.0.0.0/0`.

The first statement, is described in a high-level abstraction layer. The higher the level, the less detail. So it doesn't say anything about the underlying steps that should be taken in order for the statement to be executed. But the second statement is giving all the details necessary to create a new security group.

The flexibility of IaSQL– which makes it really awesome– is that you can create both the high-level and the low-level modules for it. Both of the above statements are already possible using IaSQL modules. The first one using a module named `aws_ecs_simplified` and the latter using the `aws_security_group` module.

```sql title="Deploy the folder 'examples/ecs-fargate/prisma/app' of the 'iasql-engine' repo to ECS on my AWS account"
-- Install the "high-level" aws_ecs_simplified IaSQL module
SELECT iasql_install('aws_ecs_simplified');
-- Create the load balancer, ECS service, task definition, etc. All ready afterwards for us to build and push to deploy the app.
INSERT INTO ecs_simplified (app_name, app_port, image_tag, public_ip) VALUES ('<app_name>', 8088, 'latest', true);
SELECT iasql_apply();
-- Use the "high-level" ecr_build function to build the folder "examples/ecs-fargate/prisma/app" from "iasql-engine" Github repo and push it to ECR
SELECT ecr_build(
  'https://github.com/iasql/iasql-engine/', -- the Github repo URL
  (SELECT id FROM repository WHERE repository_name = '<app_name>-repository')::varchar(255), -- ECR repo for the image to be pushed
  './examples/ecs-fargate/prisma/app', -- the subdirectory in Github repo
  'main', -- the Github branch or ref
  NULL -- Github personal access token - can be omitted if public repository
);
```

In this example, we've used the high-level `aws_ecs_simplified` module. It is written purely in SQL and depends on other lower level modules like `aws_ecr`, `aws_elb`, and `aws_ecs_fargate`. It will automatically create needed resources like [load balancers](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.22/aws_ecs_simplified/sql/after_install.sql#L75-L94) while the logic for the actual creation is handled by low-level modules (`aws_elb` in load balancer case). A full list of the resources it creates by leveraging low-level modules are as follows:
- Security group and its rules
- Load balancer, its listener, security group, and target group
- CloudWatch log group
- ECS cluster, service, task definition, and container definition
- IAM role
- ECR repository

We also have used another high-level function named `ecr_build` in this case. It clones a Github repo, builds an image based on the codebase and pushes that image to your ECR repository. It simplifies the use of CodeBuild (as a runner for Docker `build` and `push`), IAM, and ECR.

## Controlling the Low-level Details

Despite the high-level stuff seem to be a limiting factor for you to access the low-level details, but with `ecs_simplified` you still have the full control over the underlying details. For example, if you want to attach some additional policies to the IAM role you can simply run the following query:
```sql
UPDATE iam_role
SET attached_policies_arns = attached_policies_arns ||
                             'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess' -- attached_policies_arns is of text[] type
WHERE role_name = '<app_name>-ecs-task-exec-role';
```

