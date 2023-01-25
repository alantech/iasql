---
id: "aws_s3_entity_bucket.Bucket"
title: "Table: bucket"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS S3 buckets. Amazon Simple Storage Service (Amazon S3) is an object storage service that offers
industry-leading scalability, data availability, security, and performance.

A bucket is a container for objects stored in Amazon S3. You can store any number of objects in a bucket and can have up to 100 buckets in your account.

**`Example`**

```sql TheButton[Creates a bucket]="Creates a bucket"
INSERT INTO bucket (name) VALUES ('bucket');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-s3-integration.ts#L129
 - https://aws.amazon.com/s3/

## Columns

• `Optional` **created\_at**: `date`

Creation date

• `Optional` **policy\_document**: `any`

Complex type representing the policy attached to the bucket

**`See`**

https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-iam-policies.html

• **region**: `string`

Region for the bucket
