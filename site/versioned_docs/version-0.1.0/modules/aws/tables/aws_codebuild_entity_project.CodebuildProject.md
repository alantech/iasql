---
id: "aws_codebuild_entity_project.CodebuildProject"
title: "codebuild_project"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS CodeBuild project entities. AWS CodeBuild is a fully managed continuous integration service that
compiles source code, runs tests, and produces ready-to-deploy software packages.

A build project includes information about how to run a build, including where to get the source code,
which build environment to use, which build commands to run, and where to store the build output.

A Codebuild project can be created, then successful builds can be triggered for that specific project.

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/builds-working.html

TODO support buildspec file in repo

## Columns

• `Optional` **arn**: `string`

AWS ARN for the Codebuild project

• `Optional` **build\_spec**: `string`

Text blob with the content of the BuildSpec for the project

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html

• **compute\_type**: [`compute_type`](../enums/aws_codebuild_entity_project.ComputeType.md)

Type of compute instance where to build the project

• **environment\_type**: [`environment_type`](../enums/aws_codebuild_entity_project.EnvironmentType.md)

Type of environment where to build the project

• `Optional` **environment\_variables**: [{ `name`: `string` ; `type`: [`PLAINTEXT`](../enums/aws_codebuild_entity_project.EnvironmentVariableType.md#plaintext) ; `value`: `string`  }]

Internal environment variables to pass to the project builds

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html

• **image**: `string`

Base image where to build the project

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html

• **privileged\_mode**: `boolean`

Enables running the Docker daemon inside a Docker container. Set to true only if the build project is used to build Docker images. Otherwise, a build that attempts to interact with the Docker daemon fails.
The AWS default setting is false.

• **project\_name**: `string`

Name for codebuild project

• **region**: `string`

Region for the Codebuild project

• **service\_role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

Service role used to manage the CodeBuild project interactions

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/setting-up.html#setting-up-service-role

• **source\_location**: `string`

Path for the project's source code
For a GitHub repository, the HTTPS clone URL with the source code location

**`See`**

https://docs.aws.amazon.com/codebuild/latest/APIReference/API_ProjectSource.html

• **source\_type**: [`source_type`](../enums/aws_codebuild_entity_project.SourceType.md)

Type of source code used in the project

• `Optional` **source\_version**: `string`

Version identifier for this specific project

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/sample-source-version.html
