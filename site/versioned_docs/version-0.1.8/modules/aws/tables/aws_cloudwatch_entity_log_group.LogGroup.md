---
id: "aws_cloudwatch_entity_log_group.LogGroup"
title: "log_group"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to query for all AWS Cloudwatch log groups in the system. You can use Amazon CloudWatch Logs to monitor,
store, and access your log files from Amazon Elastic Compute Cloud (Amazon EC2) instances,
AWS CloudTrail, Route 53, and other sources.

A log group is a group of log streams that share the same retention, monitoring, and access control settings.
You can define log groups and specify which streams to put into each group.
There is no limit on the number of log streams that can belong to one log group.

**`See`**

https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html

## Columns

• `Optional` **creation\_time**: `date`

Creation time

• `Optional` **log\_group\_arn**: `string`

AWS ARN for the log group

• **log\_group\_name**: `string`

Log group name

• **region**: `string`

Region for the log group
