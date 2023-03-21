---
id: "aws_cloudwatch"
title: "aws_cloudwatch"
hide_table_of_contents: true
custom_edit_url: null
displayed_sidebar: "docs"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs queryString="view">
  <TabItem value="components" label="Components" default>

### Tables

    [log_group](../../aws/tables/aws_cloudwatch_entity_log_group.LogGroup)

    [metric_alarm](../../aws/tables/aws_cloudwatch_entity_metric_alarm.MetricAlarm)

### Functions
    [log_group_tail](../../aws/tables/aws_cloudwatch_rpcs_log_group_tail.LogGroupTailRpc)

### Enums
    [comparison_operator](../../aws/enums/aws_cloudwatch_entity_metric_alarm.comparisonOperatorEnum)

    [evaluate_low_sample_count_percentile](../../aws/enums/aws_cloudwatch_entity_metric_alarm.evaluateLowSampleCountPercentileEnum)

    [standard_unit](../../aws/enums/aws_cloudwatch_entity_metric_alarm.standardUnitEnum)

    [statistic](../../aws/enums/aws_cloudwatch_entity_metric_alarm.statisticEnum)

    [treat_missing_data](../../aws/enums/aws_cloudwatch_entity_metric_alarm.treatMissingDataEnum)

</TabItem>
  <TabItem value="code-examples" label="Code examples">

### Code examples

```testdoc
modules/aws-cloudwatch-integration.ts#AwsCloudwatch Integration Testing#Manage cloudwatch
modules/aws-tail-log-group.ts#AwsCloudwatch and AwsLambda Integration Testing#Tail logs
```

</TabItem>
</Tabs>
