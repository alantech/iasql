---
id: "aws_s3_entity_bucket_object.BucketObject"
title: "bucket_object"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage the objects associated to an S3 bucket. To store your data in Amazon S3, you work with resources known as buckets and objects.
A bucket is a container for objects. An object is a file and any metadata that describes that file.

Objects can only be listed and deleted, will need to be uploaded using an specific RPC method

**`See`**

https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingObjects.html

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
