---
id: "aws_ecr_rpcs_build.EcrBuildRpc"
title: "Method: ecr_build"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Method to build an image associated to an especific ECR repository

Returns following columns:
- imageId: AWS generated ID for the generated image

Accepts the following parameters:
- githubRepoUrl: URL where to get the source code for the build
- ecrRepositoryId: ID fot the repository where to push the image
- buildPath: Internal path on the Github repo where to read the buildspec
- githubRef: Git reference for the source code repo
- githubPersonalAccessToken: Personal Access Token used to access private repositories

**`Example`**

```sql TheButton[Trigger an ECR image build]="Trigger an ECR image build"
SELECT ecr_build('https://github.com/iasql/docker-helloworld',
(SELECT id FROM repository WHERE repository_name = '${repositoryName}')::varchar(255), '.', 'main', '<personal_access_token>');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-ecr-build-integration.ts#L104
 - https://docs.aws.amazon.com/codebuild/latest/userguide/sample-ecr.html
