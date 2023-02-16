---
id: "aws_cloudwatch_rpcs_log_group_tail.LogGroupTailRpc"
title: "log_group_tail"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method for tailing logs for an specific CloudWatch log group.

Returns a set of SQL records with the following format:

- event_id: The ID of the event for the produced log
- log_stream_name: Name of the log stream that is visualized
- event_timestamp: The timestamp for the log entry
- message: The content of the log entry

**`See`**

https://awscli.amazonaws.com/v2/documentation/api/latest/reference/logs/tail.html
