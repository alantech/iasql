---
id: "aws_ecr_entity_repository.Repository"
title: "repository"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS ECR private repositories. Amazon Elastic Container Registry (Amazon ECR) provides API operations to create,
monitor, and delete image repositories and set permissions that control who can access them.

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/userguide/Repositories.html

## Columns

• `Optional` **created\_at**: `date`

Creation date

• **image\_tag\_mutability**: [`image_tag_mutability`](../enums/aws_ecr_entity_repository.ImageTagMutability.md)

You can configure a repository to enable tag mutability to prevent image tags from being overwritten

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html

• `Optional` **images**: [`repository_image`](aws_ecr_entity_repository_image.RepositoryImage.md)[]

List of associated images published on this repository

• **region**: `string`

Reference to the associated region

• `Optional` **registry\_id**: `string`

The Amazon Web Services account ID associated with the registry that contains the repositories to be
described. If you do not specify a registry, the default registry is assumed.

**`See`**

https://docs.aws.amazon.com/cli/latest/reference/ecr/describe-repositories.html

• `Optional` **repository\_arn**: `string`

AWS ARN identifier for the repository

• **repository\_name**: `string`

Name of the repository

• `Optional` **repository\_uri**: `string`

The URI for the repository

• **scan\_on\_push**: `boolean`

Whether to scan the images as soon as it is pushed to the repository

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html
