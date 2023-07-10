---
id: "aws_sns_entity_topic.Topic"
title: "topic"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to manage AWS SNS topics. Amazon Simple Notification Service (Amazon SNS) is a managed
service that provides message delivery from publishers to subscribers (also known as producers and consumers).
Publishers communicate asynchronously with subscribers by sending messages to a topic,
which is a logical access point and communication channel.

```

@see https://github.com/alantech/iasql/blob/main/test/modules/aws-sns-integration.ts#L120
@see https://docs.aws.amazon.com/sns/latest/dg/welcome.html

## Columns

• `Optional` **arn**: `string`

The topic's ARN.

• `Optional` **content\_based\_deduplication**: `string`

Enables content-based deduplication for FIFO topics.
Applies only to FIFO topics

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html

• `Optional` **data\_protection\_policy**: `string`

The body of the policy document you want to use for this topic.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/createtopicinput.html#dataprotectionpolicy

• `Optional` **delivery\_policy**: `string`

The policy that defines how Amazon SNS retries failed deliveries to HTTP/S endpoints.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html

• `Optional` **display\_name**: `string`

The display name to use for a topic with SMS subscriptions.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html

• **fifo\_topic**: `boolean`

Set to true to create a FIFO topic

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html

• `Optional` **kms\_master\_key\_id**: `string`

The ID of an Amazon Web Services managed customer master key (CMK) for Amazon SNS or a custom CMK.
Applies only to server-side encryption

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html

• **name**: `string`

Name for the SNS topic

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/createtopiccommandinput.html#name

• `Optional` **policy**: `string`

The policy that defines who can access your topic. By default, only the topic owner can publish or subscribe to the topic.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html

• **region**: `string`

Region for the SNS topic

• `Optional` **signature\_version**: `string`

The signature version corresponds to the hashing algorithm used.
Applies only to server-side encryption

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html

• `Optional` **tracing\_config**: `string`

Tracing mode of an Amazon SNS topic.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sns/interfaces/settopicattributescommandinput.html
