---
sidebar_position: 4
slug: '/low-level-vs-high-level'
---

# Low-Level vs High-Level Modules

[Modules in IaSQL](../module) allow one to manipulate tables and call database functions that impact the state of their cloud infrastructure. Some of these modules may be described as "low level" and others as "high level", but rather than (just) referring to the features available and the difficulty of using them, these terms have a specific meaning within the IaSQL context.

Consider the following stack diagram:

```
     O
    -|-                      User
    / \
     |
     |______________
     |              |
     v              |
   ____________     |
  | High-level |    |
  |  Modules   |    |        IaSQL
  |____________|____V_____
  | Low-level Modules     |
  |_______________________|
              |
              |
              |
              v
             __
         ___/  \__
        /  Cloud  \              Infrastructure
        \_    _   /
          \__/ \_/
```

The user can use both high-level and low-level modules to manipulate their cloud infrastructure, but the high-level modules are built on top of the low-level modules, and only the low-level modules *actually* interact with their cloud infrastructure.

The high-level modules operate on top of the abstraction layer the low-level modules provide: SQL tables and functions, therefore the high-level modules *are pure SQL*.

Therefore, they cannot, on their own, perform arbitrary code execution, but can only perform operations that can be glued together by the low-level modules.

The `aws_ecs_simplified` module is one such example, with the vast majority of code [being pure SQL code](https://github.com/alantech/iasql/blob/v0.0.22/src/modules/0.0.22/aws_ecs_simplified/sql/after_install.sql) defining a new table and trigger functions to mutate the low-level module tables that it abstracts away for you.

For more information on just how nice it is to use a high-level module like `aws_ecs_simplified`, check out [this blog post on "ECS, Simplified"](https://iasql.com/blog/ecs-simplified).

As pure SQL, the barrier to entry in authoring a high-level module is lower, so anyone with the desire can write a high-level module and share it with others, and we hope to make such third-party module installation much simpler soon.

The low-level modules are tables and functions that are created by and interface with IaSQL, where module code is written to execute the necessary cloud API calls, such as [this part of the `aws_ecs_fargate` module for the `cluster` table](https://github.com/alantech/iasql/blob/v0.0.22/src/modules/0.0.22/aws_ecs_fargate/mappers/cluster.ts).

These low-level modules convert your database changes into API calls, and need to be [thoroughly tested](https://github.com/alantech/iasql/blob/v0.0.22/test/modules/aws-ecs-integration.ts) for correctness and vetted for trustworthiness that they won't utilize your cloud spending account for nefarious purposes.

For that reason, they *must* be committed to the [IaSQL repository](https://github.com/alantech/iasql) before they can be installed or used, and no third-party low-level modules are allowed.

This makes Low-Level modules in IaSQL similar to the built-in functions and libraries of programming languages: something that you'll often use in your day-to-day, but that most will never contribute to, and that's okay.

As a slight wrinkle, there are also Low-Level and High-Level Postgres Functions in IaSQL. There is a similar distinction between them, where Low-Level Functions are directly powered by IaSQL, while High-Level Functions are pure SQL built on top of other functions, tables, etc. However, some Low-Level Functions can be quite "high level" in user experience.

An "obvious" kind of low-level function comes from the `aws_s3` module, where [the `s3_upload_object` function](https://github.com/alantech/iasql/blob/v0.0.22/src/modules/0.0.22/aws_s3/rpcs/s3_upload_object.ts) allows users to upload new "objects" (files) to an S3 bucket through a SQL statement.

That provides a clear, composable function that you could use in ways never envisioned by the author of the function, such as uploading the results of a SQL query about your infrastructure into an S3 file to be consumed by an internal dashboard.

In contrast, the `aws_ecr` module defines the [`ecr_build` function](https://github.com/alantech/iasql/blob/v0.0.22/src/modules/0.0.22/aws_ecr/rpcs/build.ts) that allows one to very simply build any public Git repo (or private Github repo) with a `Dockerfile` defined and store the results in your ECR repository of choice. It is a low-level module but provides an abstracted interface (over a couple of different AWS services) in a "high-level" way. It's purpose and arguments being so particular to the task it is designed for it is unlikely to ever be used in a way the author did not envision.

As an example high-level function, we can look at the low-level `aws_account` module (yes, you can define high-level functions in low-level modules, but not vice-versa), where the [`default_aws_account` function](https://github.com/iasql/iasql/blob/v0.0.22/src/modules/0.0.22/aws_account/sql/after_install.sql#L1-L8) has been defined.

It is both a convenience function for users to alter their default region without running into a constraint on the `aws_regions` table with multiple regions marked as default, but also as the default value to insert into the `region` column in multiple tables across many low-level modules if the user does not specify which region the resource belongs to. The high-level function simply builds on top of the functionality the low-level `aws_regions` table provides.

For most users, the high-level vs low-level divide between modules and functions is unimportant and totally opaque to them, and the "high-level vs low-level" distinction they need is simply the trade-off between configurability and ease-of-use. *In general* this will line up with the actual technical distinction, as any cloud functionality *not* exposed by the low-level modules can never be recovered with the high-level modules, so the low-level modules *must* be as configurable and detailed as possible, while the high-level modules can cut whatever corners they like to provide a more tailored experience.

But that does not excuse accidental, needless complexity, and so great care is taken on the design of [the database schema these modules produce](https://iasql.com/schema/). How would someone write a high-level module if they don't understand the low-level modules in the first place?
