---
id: "aws_s3_entity_bucket_website.BucketWebsite"
title: "Table: bucket_website"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to manage AWS S3 website.

A bucket website can be used to host a static website (e.g. React app) using just the S3 bucket and no additional servers

**`Example`**

```sql TheButton[Create a Static Website For Bucket]="Create a Static Website For Bucket"
INSERT INTO bucket_website (bucket_name, index_document, error_document) VALUES ('mybucket', 'index.html', 'index.html');
```

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
