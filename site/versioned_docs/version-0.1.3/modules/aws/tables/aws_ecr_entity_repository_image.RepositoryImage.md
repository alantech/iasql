---
id: "aws_ecr_entity_repository_image.RepositoryImage"
title: "repository_image"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage images to be published in ECR repositories. Amazon Elastic Container Registry (Amazon ECR) stores Docker images, Open Container Initiative (OCI) images,
and OCI compatible artifacts in private repositories. You can use the Docker CLI, or your preferred client, to push and pull images to and from your repositories.

This table can only list and delete the associated images

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/public/public-images.html

## Columns

• **image\_digest**: `string`

The sha-256 digest of the image manifest

• **image\_id**: `string`

Internal ID for the instance
composed by digest + tag + repo type + repository name [+ region]

• **image\_tag**: `string`

The tag used for the image

• `Optional` **private\_repository**: [`repository`](aws_ecr_entity_repository.Repository.md)

Reference to the private repository that is containing the image

• **private\_repository\_region**: `string`

In the case of a private repository, reference to the region where it belongs to

• `Optional` **public\_repository**: [`public_repository`](aws_ecr_entity_public_repository.PublicRepository.md)

Reference to the public repository that is containing the image

• **pushed\_at**: `date`

Date the image was pushed into the repository

• `Optional` **registry\_id**: `string`

The Amazon Web Services account ID associated with the registry to which this image belongs.

• **size\_in\_mb**: `number`

Size of the image in MB
