---
id: "aws_s3_entity_bucket_object.BucketObject"
title: "Table: bucket_object"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage the objects associated to an S3 bucket. To store your data in Amazon S3, you work with resources known as buckets and objects.
A bucket is a container for objects. An object is a file and any metadata that describes that file.

Objects can only be listed and deleted, will need to be uploaded using an specific RPC method

**`Example`**

```sql TheButton[Manage Bucket Objects]="Manage Bucket Objects"
SELECT * FROM bucket_object WHERE bucket_name = 'bucket' AND key='object_key';
DELETE FROM bucket_object WHERE bucket_name = 'bucket' AND key='object_key';
```

**`See`**

 - https://github.com/iasql/iasql/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-s3-integration.ts#L253
 - https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingObjects.html

## Columns

• `Optional` **bucket**: [`bucket`](aws_s3_entity_bucket.Bucket.md)

Reference for the bucket containing this object

• **bucket\_name**: `string`

Name of the bucket containing this object

• `Optional` **e\_tag**: `string`

Hash for the object

**`See`**

https://docs.aws.amazon.com/AmazonS3/latest/API/API_Object.html

• **key**: `string`

Key to identify this specific object

• **region**: `string`

Region for the S3 object
