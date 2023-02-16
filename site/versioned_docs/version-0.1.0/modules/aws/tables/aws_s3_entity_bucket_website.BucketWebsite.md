---
id: "aws_s3_entity_bucket_website.BucketWebsite"
title: "bucket_website"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS S3 website.

A bucket website can be used to host a static website (e.g. React app) using just the S3 bucket and no additional servers

**`See`**

https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html

## Columns

• **bucket**: [`bucket`](aws_s3_entity_bucket.Bucket.md)

Reference for the bucket

• **bucket\_name**: `string`

Name of the bucket

• `Optional` **error\_document**: `string`

This is returned when an error occurs.

• **index\_document**: `string`

Specify the home or default page of the website.
