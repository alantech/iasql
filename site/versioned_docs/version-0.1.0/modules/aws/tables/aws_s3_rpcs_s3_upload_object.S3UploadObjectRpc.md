---
id: "aws_s3_rpcs_s3_upload_object.S3UploadObjectRpc"
title: "s3_upload_object"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to upload an S3 object

Returns following columns:
- bucket: name of the bucket to host the object
- key: identifier key of the object
- status: Status of the upload operation. OK if succeeded
- response_message: Error message in case of failure

Accepts the following parameters:
- name: name of the bucket to host the object
- key: identifier for the object
- content: blob for the object to upload
- contentType: MIME type for the uploaded object

**`See`**

https://docs.aws.amazon.com/AmazonS3/latest/userguide/upload-objects.html
