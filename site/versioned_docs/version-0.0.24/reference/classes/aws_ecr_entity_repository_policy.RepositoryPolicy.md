---
id: "aws_ecr_entity_repository_policy.RepositoryPolicy"
title: "Table: repository_policy"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS ECR private repository policies. Amazon ECR uses resource-based permissions to control access to repositories.
Resource-based permissions let you specify which IAM users or roles have access to a repository and what actions they can perform on it.

By default, only the AWS account that created the repository has access to a repository.
You can apply a policy document that allow additional permissions to your repository.

**`Example`**

```sql TheButton[Manage policies for an ECR repository]="Manage policies for an ECR repository"
INSERT INTO repository_policy (repository_id, policy_text) VALUES
((select id from repository where repository_name = 'repository'),
'{ "Version": "2012-10-17", "Statement": [ { "Sid": "DenyPull", "Effect": "Deny", "Principal": "*", "Action": [ "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer" ] } ]}');

SELECT * FROM repository_policy WHERE repository_id = (select id from repository where repository_name = 'repository');

DELETE FROM repository_policy WHERE repository_id = (select id from repository where repository_name = 'repository');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ecr-integration.ts#L291
 - https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policies.html

## Columns

• `Optional` **policy\_text**: `string`

Text containing the policy for that repository

**`See`**

https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policy-examples.html

• **region**: `string`

Reference to the associated region

• `Optional` **registry\_id**: `string`

Registry that is associated to the policy

• **repository**: [`repository`](aws_ecr_entity_repository.Repository.md)

Reference to the repository that is associated to the policy
