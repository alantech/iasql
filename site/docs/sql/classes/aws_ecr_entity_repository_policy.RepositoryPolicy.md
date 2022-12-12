---
id: "aws_ecr_entity_repository_policy.RepositoryPolicy"
title: "Table: repository_policy"
sidebar_label: "repository_policy"
custom_edit_url: null
---

Table to manage AWS ECR private repository policies

**`Example`**

```sql
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

___

• **region**: `string`

Reference to the associated region

___

• `Optional` **registry\_id**: `string`

Registry that is associated to the policy

___

• **repository**: [`repository`](aws_ecr_entity_repository.Repository.md)

Reference to the repository that is associated to the policy
