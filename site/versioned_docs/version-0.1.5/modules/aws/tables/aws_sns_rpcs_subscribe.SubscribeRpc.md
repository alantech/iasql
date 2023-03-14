---
id: "aws_sns_rpcs_subscribe.SubscribeRpc"
title: "subscribe"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Method to subscribe to an SNS topic

Returns following columns:
- arn: The ARN of the subscription that has been confirmed
- status: status of the trigger call. OK if succeeded
- error: Error message in case of failure

Accepts the following parameters:
- arn: The ARN of the topic you want to subscribe to.
- endpoint: The endpoint that you want to receive notifications. Endpoints vary by protocol
- protocol: The protocol that you want to use.
- attributes: A map of attributes with their corresponding values
- region: Region where the subscription is stored

Depending on the subscription endpoint, it will need to be confirmed with the `ConfirmSubscription` RPC call.

**`Example`**

```sql TheButton[Subscribe to an SNS topic]="Subscribe to an SNS topic"
SELECT * FROM subscribe('(SELECT arn FROM topic WHERE name='topic_name')', 'my@email.com', 'email', '{"RawMessageDelivery": "true"}');
```

**`See`**

 - https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/subscribecommandinput.html#protocol
 - https://docs.aws.amazon.com/sns/latest/dg/sns-create-subscribe-endpoint-to-topic.html
 - https://iasql.com/docs/reference/classes/aws_sns_rpcs_confirm_subscription.ConfirmSubscriptionRpc/
