---
id: "aws_sns_rpcs_confirm_subscription.ConfirmSubscriptionRpc"
title: "confirm_subscription"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to confirm an SNS subscription

Returns following columns:
- arn: The ARN of the subscription that has been confirmed
- status: status of the trigger call. OK if succeeded
- error: Error message in case of failure

Accepts the following parameters:
- arn: The ARN of the topic for which you wish to confirm a subscription.
- token: Short-lived token sent to an endpoint during the Subscribe action.
- region: Region where the subscription is stored

**`Example`**

```sql TheButton[Confirm an SNS subscription]="Confirm an SNS subscription"
SELECT * FROM confirm_subscription('<arn>', '<token>');
```

**`See`**

https://docs.aws.amazon.com/sns/latest/dg/sns-create-subscribe-endpoint-to-topic.html
