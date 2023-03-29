---
id: "aws_ecr_entity_repository_policy.RepositoryPolicy"
title: "repository_policy"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS ECR private repository policies. Amazon ECR uses resource-based permissions to control access to repositories.
Resource-based permissions let you specify which IAM users or roles have access to a repository and what actions they can perform on it.

By default, only the AWS account that created the repository has access to a repository.
You can apply a policy document that allow additional permissions to your repository.

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policies.html

## Columns

• `Optional` **policy**: `policy`

Text containing the policy for that repository

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policy-examples.html

• **region**: `string`

Reference to the associated region

• `Optional` **registry\_id**: `string`

Registry that is associated to the policy

• **repository**: [`repository`](aws_ecr_entity_repository.Repository.md)

Reference to the repository that is associated to the policy
