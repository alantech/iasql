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

Low-level modules provide building blocks that can be used by the high-level modules. In this case, `aws_security_group` defines these two entities:
- [SecurityGroup](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.22/aws_security_group/entity/index.ts#L19)
- [SecurityGroupRule](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.22/aws_security_group/entity/index.ts#L70)

Which have their own tables in the IaSQL database (`security_group` and `security_group_rule`). These tables can be easily used for CRUD operations on those entities. For example, if you execute an `INSERT` statement in the `security_group` table followed by an `iasql_apply()` RPC, a new security group will be created in your AWS account. The logic for creation of a `SecurityGroup` entity in the cloud is also [handled by the `aws_security_group` module](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.22/aws_security_group/index.ts#L219). So this module is providing a great building block for doing all the CRUD operations on `SecurityGroup` entities on the cloud.

Now comes in the `aws_ecs_simplified` high-level module. It takes the advantage of the CRUD operations handled by the `aws_security_group` module. So when you insert a new record into the `ecs_simplified` table (to create an ECS app with all the needed resources), that `INSERT` command [triggers](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.22/aws_ecs_simplified/sql/after_install.sql#L159-L165) a function that [inserts records for a new security group with two rules](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.22/aws_ecs_simplified/sql/after_install.sql#L64-L73) into the tables managed by `aws_security_group`. So in the next `iasql_apply()`, the `aws_security_group` module will provision that security group and add those two rules to it.

We will explain the different high-level operations available in IaSQL later in this doc, but let's first see an example of `aws_ecs_simplified` and how it works, before we go into that level of detail.

## A High-level Example Using `aws_ecs_simplified` Module and `ecr_build` RPC

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

We also have used another high-level function named `ecr_build` in this guide. It clones a Github repo, builds an image based on the codebase and pushes that image to your ECR repository. It simplifies the use of CodeBuild (as a runner for Docker `build` and `push`), IAM, and ECR.

## Controlling the Low-level Details

Despite the high-level stuff seem to be a limiting factor for you to access the low-level details, but with `ecs_simplified` you still have the full control over the underlying details. For example, if you want to attach some additional policies to the IAM role you can simply run the following query:
```sql
UPDATE iam_role
SET attached_policies_arns = attached_policies_arns ||
                             'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess' -- attached_policies_arns is of text[] type
WHERE role_name = '<app_name>-ecs-task-exec-role';
```

### Types of High-level IaSQL Operations

We saw that with the `aws_ecs_simplified`, you have access to the low-level details while benefiting from the high-level simplicity. But the `ecr_build` RPC function and the `aws_ecs_simplified` module come from two different natures:
- `aws_ecs_simplified` module is a pure-SQL module, and it could even live outside the main `iasql-engine` repo. And in that case, it could be used with a syntax like `SELECT iasql_install('http://github.com/you/another-pure-sql-module');`. A pure-SQL module will leverage the already-built low-level IaSQL modules and trigger their behavior by doing manipulations on their database tables. For example, it can do a `INSERT INTO load_balancer` query and trigger [the `cloud.create` logic](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.22/aws_elb/mappers/load_balancer.ts#L246) of the [load balancer entity](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.22/aws_elb/entity/load_balancer.ts) in the `aws_elb` low-level module.
- `ecr_build` is an RPC function under the `aws_ecr` module, and [it's written in Node.js](https://github.com/iasql/iasql-engine/blob/main/src/modules/0.0.22/aws_ecr/rpcs/build.ts#L92). Its relation with the low-level modules (such as `aws_iam`) can't be altered, and its code cannot reside anywhere outside the main `iasql-engine` repository.

So, if you're doing something that can be done using the pure-SQL commands working with the low-level modules in IaSQL, your code can reside in your own Github repository. But if you're doing something that can't be done just by using the building blocks available, you can create a new one yourself. Just add the RPC, or the module to the `iasql-engine` codebase, and submit a PR. Reading our [contribution guide](https://github.com/iasql/iasql-engine/blob/main/CONTRIBUTING.md) can help you and if you have questions regarding the development or the usage of our system, feel free to ask it in our [Discord channel](https://discord.com/invite/machGGczea). 
