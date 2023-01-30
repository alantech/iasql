---
id: "aws_ecr_entity_public_repository.PublicRepository"
title: "Table: public_repository"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS ECR public repositories. Amazon Elastic Container Registry provides API operations to create,
monitor, and delete public image repositories and set permissions that control who can push images to them.

Amazon ECR integrates with the Docker CLI to push images from your development environments to your public repositories.

**`Example`**

```sql TheButton[Manage an ECR public repo]="Manage an ECR public repo"
INSERT INTO public_repository (repository_name) VALUES ('repository_name');
SELECT * FROM public_repository WHERE repository_name = 'repository_name';
DELETE FROM public_repository WHERE repository_name = 'repository_name';
```

**`See`**

 - https://github.com/iasql/iasql/blob/main/test/modules/aws-ecr-integration.ts#L432
 - https://docs.aws.amazon.com/AmazonECR/latest/public/public-repositories.html

## Columns

• `Optional` **created\_at**: `date`

Creation date

• `Optional` **images**: [`repository_image`](aws_ecr_entity_repository_image.RepositoryImage.md)[]

List of associated images published on this repository

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
