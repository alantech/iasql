---
id: "aws_cloudwatch_rpcs_log_group_tail.LogGroupTailRpc"
title: "Table: log_group_tail"
sidebar_label: "log_group_tail"
custom_edit_url: null
---

Method for tailing logs for an specific CloudWatch log group.

Returns a set of SQL records with the following format:

- event_id: The ID of the event for the produced log
- log_stream_name: Name of the log stream that is visualized
- event_timestamp: The timestamp for the log entry
- message: The content of the log entry

**`Example`**

```sql
  SELECT * FROM log_group_tail('log_group_name');
```

**`See`**

 - https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-tail-log-group.ts#L143
 - https://awscli.amazonaws.com/v2/documentation/api/latest/reference/logs/tail.html

## Columns

• **filter\_log\_events**: (`client`: `cloud_watch_logs`, ...`args`: `any`[]) => `promise`<`filtered_log_event`[]\>

___

• **module**: [`aws_cloudwatch_module`](aws_cloudwatch.AwsCloudwatchModule.md)

___

• **output\_table**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `event_id` | ``"varchar"`` |
| `event_timestamp` | ``"timestamp with time zone"`` |
| `log_stream_name` | ``"varchar"`` |
| `message` | ``"varchar"`` |
