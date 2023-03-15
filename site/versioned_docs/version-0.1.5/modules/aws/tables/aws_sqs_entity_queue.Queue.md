---
id: "aws_sqs_entity_queue.Queue"
title: "queue"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

## Columns

• `Optional` **arn**: `string`

The queue ARN.

• **delay\_seconds**: `number`

The length of time, in seconds, for which the delivery of all messages in the queue is delayed.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html

• **fifo\_queue**: `boolean`

Designates a queue as FIFO. If not specified, the queue will be created in standard mode.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html

• **maximum\_message\_size**: `number`

The limit of how many bytes a message can contain before Amazon SQS rejects it.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html

• **message\_retention\_period**: `number`

The length of time, in seconds, for which Amazon SQS retains a message.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html

• **name**: `string`

Name for the SQS queue

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html#queuename

• `Optional` **policy**: `policy`

The queue's policy. A valid Amazon Web Services policy.

**`See`**

https://docs.aws.amazon.com/IAM/latest/UserGuide/PoliciesOverview.html

• **receive\_message\_wait\_time\_seconds**: `number`

The length of time, in seconds, for which a ReceiveMessage action waits for a message to arrive.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html

• **region**: `string`

Region for the SQS queue

• `Optional` **url**: `string`

Amazon SQS assigns a unique identifier called a queue URL to each new queue.

• **visibility\_timeout**: `number`

The visibility timeout for the queue, in seconds. Valid values: An integer from 0 to 43,200 (12 hours).

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/interfaces/createqueuecommandinput.html
