---
id: "aws_s3"
title: "aws_s3"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [bucket](../../aws/tables/aws_s3_entity_bucket.Bucket)

    [bucket_object](../../aws/tables/aws_s3_entity_bucket_object.BucketObject)

    [bucket_website](../../aws/tables/aws_s3_entity_bucket_website.BucketWebsite)

    [public_access_block](../../aws/tables/aws_s3_entity_public_access_block.PublicAccessBlock)

### Functions
    [s3_upload_object](../../aws/tables/aws_s3_rpcs_s3_upload_object.S3UploadObjectRpc)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

```testdoc
modules/aws-s3-integration.ts#S3 Integration Testing#Manage buckets
modules/aws-s3-integration.ts#S3 bucket policy integration testing#Manage policies
```

</TabItem>
</Tabs>
