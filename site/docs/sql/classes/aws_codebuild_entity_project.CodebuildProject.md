---
id: "aws_codebuild_entity_project.CodebuildProject"
title: "Table: codebuild_project"
sidebar_label: "codebuild_project"
custom_edit_url: null
---

Table to manage AWS CodeBuild project entities. A Codebuild project can be
created, then successful builds can be triggered for that specific project.

**`Example`**

```sql
INSERT INTO codebuild_project (project_name, source_type, service_role_name, source_location)
VALUES ('codebuild_project', 'GITHUB', 'codebuild_role_name', 'https://github.com/iasql/iasql-engine');
DELETE FROM codebuild_project WHERE project_name='codebuild_project';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-codebuild-integration.ts#L298
 - https://docs.aws.amazon.com/codebuild/latest/userguide/builds-working.html

TODO support buildspec file in repo

## Columns

• `Optional` **arn**: `string`

AWS ARN for the Codebuild project

___

• `Optional` **build\_spec**: `string`

Text blob with the content of the BuildSpec for the project

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html

___

• **compute\_type**: [`compute_type`](../enums/aws_codebuild_entity_project.ComputeType.md)

Type of compute instance where to build the project

___

• **environment\_type**: [`environment_type`](../enums/aws_codebuild_entity_project.EnvironmentType.md)

Type of environment where to build the project

___

• `Optional` **environment\_variables**: [{ `name`: `string` ; `type`: [`PLAINTEXT`](../enums/aws_codebuild_entity_project.EnvironmentVariableType.md#plaintext) ; `value`: `string`  }]

Internal environment variables to pass to the project builds

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html

___

• **image**: `string`

Base image where to build the project

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-available.html

___

• **privileged\_mode**: `boolean`

Enables running the Docker daemon inside a Docker container. Set to true only if the build project is used to build Docker images. Otherwise, a build that attempts to interact with the Docker daemon fails.
The AWS default setting is false.

___

• **project\_name**: `string`

Name for codebuild project

___

• **region**: `string`

Region for the Codebuild project

___

• **service\_role**: [`iam_role`](aws_iam_entity_role.IamRole.md)

Service role used to manage the CodeBuild project interactions

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/setting-up.html#setting-up-service-role

___

• **source\_location**: `string`

Path for the project's source code
For a GitHub repository, the HTTPS clone URL with the source code location

**`See`**

https://docs.aws.amazon.com/codebuild/latest/APIReference/API_ProjectSource.html

___

• **source\_type**: [`source_type`](../enums/aws_codebuild_entity_project.SourceType.md)

Type of source code used in the project

___

• `Optional` **source\_version**: `string`

Version identifier for this specific project

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/sample-source-version.html
