---
id: "aws_cloudwatch_entity_metric_alarm.MetricAlarm"
title: "metric_alarm"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Table to query for all AWS Cloudwatch metric alarms in the system.
You can use Amazon CloudWatch Logs to monitor,store, and access your log files
from Amazon Elastic Compute Cloud (Amazon EC2) instances,
AWS CloudTrail, Route 53, and other sources.

A metric alarm watches a single CloudWatch metric or the result of a math expression
based on CloudWatch metrics. The alarm performs one or more actions based on the
value of the metric or expression relative to a threshold over a number of time periods.
The action can be sending a notification to an Amazon SNS topic, performing an Amazon EC2
action or an Amazon EC2 Auto Scaling action, or creating an OpsItem or incident in Systems Manager.

**`See`**

https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html

## Columns

• `Optional` **actions\_enabled**: `boolean`

Indicates whether actions should be executed during any changes to the alarm state

• `Optional` **alarm\_actions**: `string`[]

The actions to execute when this alarm transitions to the ALARM state from any other state.
Each action is specified as an Amazon Resource Name (ARN).

• **alarm\_arn**: `string`

The Amazon Resource Name (ARN) of the alarm.

• `Optional` **alarm\_description**: `string`

The description for the alarm

• **alarm\_name**: `string`

Alarm name

• `Optional` **comparison\_operator**: [`comparison_operator`](../enums/aws_cloudwatch_entity_metric_alarm.comparisonOperatorEnum.md)

The arithmetic operation to use when comparing the specified statistic and threshold.
The specified statistic value is used as the first operand.

• `Optional` **datapoints\_to\_alarm**: `number`

The number of data points that must be breaching to trigger the alarm.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#datapointstoalarm

• **dimensions**: { `name`: `undefined` \| `string` ; `value`: `undefined` \| `string`  }[]

The dimensions for the metric specified in MetricName

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/dimension.html

• `Optional` **evaluate\_low\_sample\_count\_percentile**: [`evaluate_low_sample_count_percentile`](../enums/aws_cloudwatch_entity_metric_alarm.evaluateLowSampleCountPercentileEnum.md)

Used only for alarms based on percentiles

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#evaluatelowsamplecountpercentile

• `Optional` **evaluation\_periods**: `number`

The number of periods over which data is compared to the specified threshold.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#evaluationperiods

• `Optional` **extended\_statistic**: `string`

The percentile statistic for the metric specified in MetricName.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#extendedstatistic

• `Optional` **insufficient\_data\_actions**: `string`[]

The actions to execute when this alarm transitions to the INSUFFICIENT_DATA state from any other state.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#insufficientdataactions

• `Optional` **metric\_name**: `string`

The name for the metric associated with the alarm.

• **metrics**: { `account_id?`: `string` ; `expression?`: `string` ; `id`: `undefined` \| `string` ; `label?`: `string` ; `metric_stat?`: { `metric`: `undefined` \| { `dimensions?`: { `name`: `undefined` \| `string` ; `value`: `undefined` \| `string`  }[] ; `metric_name?`: `string` ; `namespace?`: `string`  } ; `period`: `undefined` \| `number` ; `stat`: `undefined` \| `string` ; `unit?`: `string`  } ; `period?`: `number` ; `return_data?`: `boolean`  }[]

An array of MetricDataQuery structures that enable you to create an alarm based on the result of a metric math expression.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#metrics

• `Optional` **namespace**: `string`

The namespace for the metric associated specified in MetricName.

• `Optional` **ok\_actions**: `string`[]

The actions to execute when this alarm transitions to an OK state from any other state.

• `Optional` **period**: `number`

The length, in seconds, used each time the metric specified in MetricName is evaluated.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#period

• **region**: `string`

Region for the alarm

• `Optional` **statistic**: [`statistic`](../enums/aws_cloudwatch_entity_metric_alarm.statisticEnum.md)

The statistic for the metric specified in MetricName, other than percentile.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#statistic

• `Optional` **threshold**: `number`

The value against which the specified statistic is compared.

• `Optional` **threshold\_metric\_id**: `string`

If this is an alarm based on an anomaly detection model, make this value match the ID of the ANOMALY_DETECTION_BAND function.

• `Optional` **treat\_missing\_data**: [`treat_missing_data`](../enums/aws_cloudwatch_entity_metric_alarm.treatMissingDataEnum.md)

Sets how this alarm is to handle missing data points.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#treatmissingdata

• `Optional` **unit**: [`standard_unit`](../enums/aws_cloudwatch_entity_metric_alarm.standardUnitEnum.md)

The unit of measure for the statistic.

**`See`**

https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#unit
