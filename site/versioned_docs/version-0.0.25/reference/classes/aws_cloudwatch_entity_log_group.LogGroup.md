---
id: "aws_cloudwatch_entity_log_group.LogGroup"
title: "Table: log_group"
displayed_sidebar: "docs"
sidebar_label: "SQL"
sidebar_position: 0
custom_edit_url: null
---

Table to query for all AWS Cloudwatch log groups in the system. You can use Amazon CloudWatch Logs to monitor,
store, and access your log files from Amazon Elastic Compute Cloud (Amazon EC2) instances,
AWS CloudTrail, Route 53, and other sources.

A log group is a group of log streams that share the same retention, monitoring, and access control settings.
You can define log groups and specify which streams to put into each group.
There is no limit on the number of log streams that can belong to one log group.

**`Example`**

```sql TheButton[Manae a CloudWatch Log group entry]="Manage a CloudWatch Log group entry"
INSERT INTO log_group (log_group_name) VALUES ('log_name');

SELECT * FROM log_group WHERE log_group_name = 'log_name';

DELETE FROM log_group WHERE log_group_name = 'log_name';
```

**`See`**

 - https://github.com/iasql/iasql/blob/main/test/modules/aws-cloudwatch-integration.ts#L309
 - https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html

## Columns

• `Optional` **creation\_time**: `date`

Creation time

• `Optional` **log\_group\_arn**: `string`

AWS ARN for the log group

• **log\_group\_name**: `string`

Log group name

• **region**: `string`

Region for the log group
