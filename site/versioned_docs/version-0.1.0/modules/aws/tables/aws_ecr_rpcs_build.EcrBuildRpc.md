---
id: "aws_ecr_rpcs_build.EcrBuildRpc"
title: "ecr_build"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to build an image associated to an especific ECR repository

Returns following columns:
- imageId: AWS generated ID for the generated image

Accepts the following parameters:
- githubRepoUrl: URL where to get the source code for the build
- ecrRepositoryId: ID fot the repository where to push the image
- buildPath: Internal path on the Github repo where to read the buildspec
- githubRef: Git reference for the source code repo
- githubPersonalAccessToken: Personal Access Token used to access private repositories

**`See`**

https://docs.aws.amazon.com/codebuild/latest/userguide/sample-ecr.html
