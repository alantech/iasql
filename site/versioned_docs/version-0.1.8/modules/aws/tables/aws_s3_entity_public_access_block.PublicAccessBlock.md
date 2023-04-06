---
id: "aws_s3_entity_public_access_block.PublicAccessBlock"
title: "public_access_block"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS S3 bucket public access.

The Amazon S3 Block Public Access feature provides settings for access points, buckets, and accounts to help you manage public access to Amazon S3 resources

**`See`**

https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html

## Columns

• `Optional` **block\_public\_acls**: `boolean`

Block public access to buckets and objects granted through new access control lists (ACLs)

• `Optional` **block\_public\_policy**: `boolean`

Block public access to buckets and objects granted through new public bucket or access point policies

• **bucket**: [`bucket`](aws_s3_entity_bucket.Bucket.md)

Reference for the bucket

• **bucket\_name**: `string`

Name of the bucket

• `Optional` **ignore\_public\_acls**: `boolean`

Block public access to buckets and objects granted through any access control lists (ACLs)

• `Optional` **restrict\_public\_buckets**: `boolean`

Block public and cross-account access to buckets and objects through any public bucket or access point policies
