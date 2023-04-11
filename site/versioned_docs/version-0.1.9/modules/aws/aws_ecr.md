---
id: "aws_ecr"
title: "aws_ecr"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [public_repository](../../aws/tables/aws_ecr_entity_public_repository.PublicRepository)

    [repository](../../aws/tables/aws_ecr_entity_repository.Repository)

    [repository_image](../../aws/tables/aws_ecr_entity_repository_image.RepositoryImage)

    [repository_policy](../../aws/tables/aws_ecr_entity_repository_policy.RepositoryPolicy)

### Functions
    [ecr_build](../../aws/tables/aws_ecr_rpcs_build.EcrBuildRpc)

### Enums
    [image_tag_mutability](../../aws/enums/aws_ecr_entity_repository.ImageTagMutability)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

```testdoc
modules/aws-ecr-integration.ts#private repository#Managing private repositories
modules/aws-ecr-integration.ts#public repository#Managing public repositories
modules/aws-ecr-build-integration.ts#AwsEcrBuild Integration Testing#Build images
```

</TabItem>
</Tabs>
