---
id: "aws_ecr"
title: "aws_ecr"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="Components" label="Components" default>

### Tables

    [public_repository](../../classes/aws_ecr_entity_public_repository.PublicRepository)

    [repository](../../classes/aws_ecr_entity_repository.Repository)

    [repository_image](../../classes/aws_ecr_entity_repository_image.RepositoryImage)

    [repository_policy](../../classes/aws_ecr_entity_repository_policy.RepositoryPolicy)

### Functions
    [ecr_build](../../classes/aws_ecr_rpcs_build.EcrBuildRpc)

### Enums
    [image_tag_mutability](../../enums/aws_ecr_entity_repository.ImageTagMutability)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

```testdoc
modules/aws-ecr-integration.ts#private repository#Managing private repositories
modules/aws-ecr-integration.ts#public repository#Managing public repositories
modules/aws-ecr-build-integration.ts#AwsEcrBuild Integration Testing#Build images
```

</TabItem>
</Tabs>
