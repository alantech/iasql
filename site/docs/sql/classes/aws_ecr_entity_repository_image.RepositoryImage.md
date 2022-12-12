---
id: "aws_ecr_entity_repository_image.RepositoryImage"
title: "Table: repository_image"
sidebar_label: "repository_image"
custom_edit_url: null
---

Table to manage images to be published in ECR repositories
It can only list and delete the associated images

**`Example`**

```sql
SELECT * FROM repository_image WHERE private_repository_id = (select id from repository where repository_name = 'test-repo');
DELETE FROM public_repository WHERE repository_name = 'repository_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ecr-integration.ts#L200
 - https://docs.aws.amazon.com/AmazonECR/latest/public/public-images.html

## Columns

• **image\_digest**: `string`

The sha-256 digest of the image manifest

___

• **image\_id**: `string`

Internal ID for the instance
composed by digest + tag + repo type + repository name [+ region]

___

• **image\_tag**: `string`

The tag used for the image

___

• `Optional` **private\_repository**: [`repository`](aws_ecr_entity_repository.Repository.md)

Reference to the private repository that is containing the image

___

• **private\_repository\_region**: `string`

In the case of a private repository, reference to the region where it belongs to

___

• `Optional` **public\_repository**: [`public_repository`](aws_ecr_entity_public_repository.PublicRepository.md)

Reference to the public repository that is containing the image

___

• `Optional` **registry\_id**: `string`

The Amazon Web Services account ID associated with the registry to which this image belongs.
