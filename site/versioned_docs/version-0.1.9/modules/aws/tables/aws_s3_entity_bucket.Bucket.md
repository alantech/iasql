---
id: "aws_s3_entity_bucket.Bucket"
title: "bucket"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS S3 buckets. Amazon Simple Storage Service (Amazon S3) is an object storage service that offers
industry-leading scalability, data availability, security, and performance.

A bucket is a container for objects stored in Amazon S3. You can store any number of objects in a bucket and can have up to 100 buckets in your account.

**`See`**

https://aws.amazon.com/s3/

## Columns

• `Optional` **created\_at**: `date`

Creation date

• `Optional` **policy**: `policy`

Complex type representing the policy attached to the bucket

**`See`**

https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-iam-policies.html

• **region**: `string`

Region for the bucket

• `Optional` **tags**: `Object`

Complex type to tags for the bucket

#### Type definition

▪ [key: `string`]: `string`
