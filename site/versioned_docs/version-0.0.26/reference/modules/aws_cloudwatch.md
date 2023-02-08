---
id: "aws_cloudwatch"
title: "aws_cloudwatch"
displayed_sidebar: "docs"
sidebar_label: "Reference"
sidebar_position: 0
hide_table_of_contents: true
custom_edit_url: null
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="Components" label="Components" default>

### Tables

    [log_group](../../classes/aws_cloudwatch_entity_log_group.LogGroup)

    [metric_alarm](../../classes/aws_cloudwatch_entity_metric_alarm.MetricAlarm)

### Functions
    [log_group_tail](../../classes/aws_cloudwatch_rpcs_log_group_tail.LogGroupTailRpc)

### Enums
    [comparison_operator](../../enums/aws_cloudwatch_entity_metric_alarm.comparisonOperatorEnum)

    [evaluate_low_sample_count_percentile](../../enums/aws_cloudwatch_entity_metric_alarm.evaluateLowSampleCountPercentileEnum)

    [standard_unit](../../enums/aws_cloudwatch_entity_metric_alarm.standardUnitEnum)

    [statistic](../../enums/aws_cloudwatch_entity_metric_alarm.statisticEnum)

    [treat_missing_data](../../enums/aws_cloudwatch_entity_metric_alarm.treatMissingDataEnum)

</TabItem>
  <TabItem value="Code examples" label="Code examples">

### Code examples

```testdoc
modules/aws-cloudwatch-integration.ts#AwsCloudwatch Integration Testing#Manage cloudwatch
modules/aws-tail-log-group.ts#AwsCloudwatch and AwsLambda Integration Testing#Tail logs
```

</TabItem>
</Tabs>
