---
id: "aws_s3_entity_bucket.Bucket"
title: "Table: bucket"
sidebar_label: "bucket"
custom_edit_url: null
---

Table to manage AWS S3 buckets.

**`Example`**

```sql
INSERT INTO bucket (name) VALUES ('bucket');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-s3-integration.ts#L129
 - https://aws.amazon.com/s3/

## Columns

• `Optional` **created\_at**: `date`

Creation date

___

• `Optional` **policy\_document**: `any`

Complex type representing the policy attached to the bucket

**`See`**

https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-iam-policies.html

___

• **region**: `string`

Region for the bucket
