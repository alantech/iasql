---
id: "aws_s3_rpcs_s3_upload_object.S3UploadObjectRpc"
title: "Method: s3_upload_object"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

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

**`Example`**

```sql TheButton[Uploads an object]="Uploads an object"
SELECT * FROM s3_upload_object('bucket', 'object_key', '{
name: 'Iasql',
value: 'Hello world!',
}', 'application/json')`,
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-s3-integration.ts#L209
 - https://docs.aws.amazon.com/AmazonS3/latest/userguide/upload-objects.html
