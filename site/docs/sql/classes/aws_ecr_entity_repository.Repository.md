---
id: "aws_ecr_entity_repository.Repository"
title: "Table: repository"
sidebar_label: "repository"
custom_edit_url: null
---

Table to manage AWS ECR private repositories.

**`Example`**

```sql
INSERT INTO repository (repository_name, scan_on_push, image_tag_mutability) VALUES ('repository', false, 'MUTABLE');
SELECT * FROM repository WHERE repository_name = 'repository';
DELETE FROM repository WHERE repository_name = 'repository';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ecr-integration.ts#L113
 - https://docs.aws.amazon.com/AmazonECR/latest/userguide/Repositories.html

## Columns

• `Optional` **created\_at**: `date`

Creation date

___

• **image\_tag\_mutability**: [`image_tag_mutability`](../enums/aws_ecr_entity_repository.ImageTagMutability.md)

You can configure a repository to enable tag mutability to prevent image tags from being overwritten

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html

___

• `Optional` **images**: [`repository_image`](aws_ecr_entity_repository_image.RepositoryImage.md)[]

List of associated images published on this repository

___

• **region**: `string`

Reference to the associated region

___

• `Optional` **registry\_id**: `string`

The Amazon Web Services account ID associated with the registry that contains the repositories to be
described. If you do not specify a registry, the default registry is assumed.

**`See`**

https://docs.aws.amazon.com/cli/latest/reference/ecr/describe-repositories.html

___

• `Optional` **repository\_arn**: `string`

AWS ARN identifier for the repository

___

• **repository\_name**: `string`

Name of the repository

___

• `Optional` **repository\_uri**: `string`

The URI for the repository

___

• **scan\_on\_push**: `boolean`

Whether to scan the images as soon as it is pushed to the repository

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-scanning.html
