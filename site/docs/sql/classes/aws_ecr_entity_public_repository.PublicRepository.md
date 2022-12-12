---
id: "aws_ecr_entity_public_repository.PublicRepository"
title: "Table: public_repository"
sidebar_label: "public_repository"
custom_edit_url: null
---

Table to manage AWS ECR public repositories.

**`Example`**

```sql
INSERT INTO public_repository (repository_name) VALUES ('repository_name');
SELECT * FROM public_repository WHERE repository_name = 'repository_name';
DELETE FROM public_repository WHERE repository_name = 'repository_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ecr-integration.ts#L432
 - https://docs.aws.amazon.com/AmazonECR/latest/public/public-repositories.html

## Columns

• `Optional` **created\_at**: `date`

Creation date

___

• `Optional` **images**: [`repository_image`](aws_ecr_entity_repository_image.RepositoryImage.md)[]

List of associated images published on this repository

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
