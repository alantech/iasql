---
id: "aws_sns_entity_subscription.Subscription"
title: "subscription"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Read-only table to retrieve the list AWS SNS subscriptions. Amazon Simple Notification Service (Amazon SNS) is a managed
service that provides message delivery from publishers to subscribers (also known as producers and consumers).
Publishers communicate asynchronously with subscribers by sending messages to a topic, which
is a logical access point and communication channel.

```

@see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-sns-integration.ts#L120
@see https://docs.aws.amazon.com/sns/latest/dg/welcome.html

## Columns

• `Optional` **arn**: `string`

The subscription's ARN.

• `Optional` **endpoint**: `string`

The endpoint that you want to receive notifications. Endpoints vary by protocol

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/subscribecommandinput.html#endpoint

• `Optional` **protocol**: `string`

The protocol that you want to use

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/subscribecommandinput.html#protocol

• **region**: `string`

Region for the SNS subscription

• **topic**: [`topic`](aws_sns_entity_topic.Topic.md)

SNS topic to subscribe
