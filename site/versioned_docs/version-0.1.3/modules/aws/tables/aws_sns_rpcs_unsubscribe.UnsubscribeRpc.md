---
id: "aws_sns_rpcs_unsubscribe.UnsubscribeRpc"
title: "unsubscribe"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to unsubscribe from an SNS topic

Returns following columns:
- status: status of the trigger call. OK if succeeded
- error: Error message in case of failure

Accepts the following parameters:
- arn: The ARN of the subscription you want to unsubscribe from.
- region: Region where the subscription is stored
*

**`Example`**

```sql TheButton[Unsubscribe from an SNS topic]="Unsubscribe from an SNS topic"
SELECT * FROM unsubscribe('subscription_arn');
```

**`See`**

https://docs.aws.amazon.com/sns/latest/dg/sns-create-subscribe-endpoint-to-topic.html
