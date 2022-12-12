---
id: "aws_cloudwatch_entity_log_group.LogGroup"
title: "Table: log_group"
sidebar_label: "log_group"
custom_edit_url: null
---

Table to query for all AWS Cloudwatch log groups in the system.

**`Example`**

```sql
INSERT INTO log_group (log_group_name) VALUES ('log_name');
SELECT * FROM log_group WHERE log_group_name = 'log_name';
DELETE FROM log_group WHERE log_group_name = 'log_name';
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-cloudwatch-integration.ts#L309
 - https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html

## Columns

• `Optional` **creation\_time**: `date`

Creation time

___

• `Optional` **log\_group\_arn**: `string`

AWS ARN for the log group

___

• **log\_group\_name**: `string`

Log group name

___

• **region**: `string`

Region for the log group
