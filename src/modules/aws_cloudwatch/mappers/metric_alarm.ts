import isEqual from 'lodash.isequal';

import {
  CloudWatch,
  MetricAlarm as AWSMetricAlarm,
  PutMetricAlarmCommandInput,
} from '@aws-sdk/client-cloudwatch';

import { AwsCloudwatchModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import {
  comparisonOperatorEnum,
  evaluateLowSampleCountPercentileEnum,
  MetricAlarm,
  standardUnitEnum,
  statisticEnum,
  treatMissingDataEnum,
} from '../entity';

export class MetricAlarmMapper extends MapperBase<MetricAlarm> {
  module: AwsCloudwatchModule;
  entity = MetricAlarm;
  equals = (a: MetricAlarm, b: MetricAlarm) =>
    isEqual(a.actionsEnabled, b.actionsEnabled) &&
    Object.is(a.actionsEnabled, b.actionsEnabled) &&
    Object.is(a.alarmDescription, b.alarmDescription) &&
    isEqual(a.comparisonOperator, b.comparisonOperator) &&
    Object.is(a.datapointsToAlarm, b.datapointsToAlarm) &&
    isEqual(a.dimensions, b.dimensions) &&
    isEqual(a.evaluateLowSampleCountPercentile, b.evaluateLowSampleCountPercentile) &&
    Object.is(a.evaluationPeriods, b.evaluationPeriods) &&
    Object.is(a.extendedStatistic, b.extendedStatistic) &&
    isEqual(a.insufficientDataActions, b.insufficientDataActions) &&
    Object.is(a.metricName, b.metricName) &&
    isEqual(a.metrics, b.metrics) &&
    Object.is(a.namespace, b.namespace) &&
    isEqual(a.okActions, b.okActions) &&
    Object.is(a.period, b.period) &&
    isEqual(a.statistic, b.statistic) &&
    Object.is(a.threshold, b.threshold) &&
    Object.is(a.thresholdMetricId, b.thresholdMetricId) &&
    isEqual(a.treatMissingData, b.treatMissingData) &&
    Object.is(a.alarmArn, b.alarmArn);

  putMetricAlarm = crudBuilder2<CloudWatch, 'putMetricAlarm'>('putMetricAlarm', input => input);

  getMetricAlarm = crudBuilderFormat<CloudWatch, 'describeAlarms', AWSMetricAlarm[] | undefined>(
    'describeAlarms',
    name => ({ AlarmNames: [name] }),
    res => res?.MetricAlarms,
  );

  getMetricAlarms = crudBuilderFormat<CloudWatch, 'describeAlarms', AWSMetricAlarm[] | undefined>(
    'describeAlarms',
    () => ({}),
    res => res?.MetricAlarms,
  );

  deleteMetricAlarm = crudBuilder2<CloudWatch, 'deleteAlarms'>('deleteAlarms', name => ({
    AlarmNames: [name],
  }));

  metricAlarmMapper(ma: AWSMetricAlarm, region: string) {
    const out = new MetricAlarm();
    // To ignore faulty data in AWS, instead of throwing an error on bad data, we return
    // undefined
    if (!ma.AlarmArn || !ma.AlarmName) return undefined;
    out.alarmArn = ma.AlarmArn;
    out.actionsEnabled = ma.ActionsEnabled;
    out.alarmActions = ma.AlarmActions;
    out.alarmName = ma.AlarmName;
    out.alarmDescription = ma.AlarmDescription;
    out.comparisonOperator = ma.ComparisonOperator as comparisonOperatorEnum;
    out.datapointsToAlarm = ma.DatapointsToAlarm;
    out.dimensions = ma.Dimensions as any;
    out.evaluateLowSampleCountPercentile =
      ma.EvaluateLowSampleCountPercentile as evaluateLowSampleCountPercentileEnum;
    out.evaluationPeriods = ma.EvaluationPeriods;
    out.extendedStatistic = ma.ExtendedStatistic;
    out.insufficientDataActions = ma.InsufficientDataActions;
    out.metricName = ma.MetricName;
    out.metrics = ma.Metrics as any;
    out.namespace = ma.Namespace;
    out.okActions = ma.OKActions;
    out.period = ma.Period;
    out.statistic = ma.Statistic as statisticEnum;
    out.threshold = ma.Threshold;
    out.thresholdMetricId = ma.ThresholdMetricId;
    out.treatMissingData = ma.TreatMissingData as treatMissingDataEnum;
    out.unit = ma.Unit as standardUnitEnum;
    out.region = region;
    return out;
  }

  cloud = new Crud2<MetricAlarm>({
    create: async (ms: MetricAlarm[], ctx: Context) => {
      const out = [];
      for (const m of ms) {
        const client = (await ctx.getAwsClient(m.region)) as AWS;

        const input: PutMetricAlarmCommandInput = {
          ActionsEnabled: m.actionsEnabled,
          AlarmActions: m.alarmActions,
          AlarmDescription: m.alarmDescription,
          AlarmName: m.alarmName,
          ComparisonOperator: m.comparisonOperator?.toString(),
          DatapointsToAlarm: m.datapointsToAlarm,
          Dimensions: m.dimensions,
          EvaluateLowSampleCountPercentile: m.evaluateLowSampleCountPercentile?.toString(),
          EvaluationPeriods: m.evaluationPeriods,
          ExtendedStatistic: m.extendedStatistic,
          InsufficientDataActions: m.insufficientDataActions,
          MetricName: m.metricName,
          Metrics: m.metrics,
          Namespace: m.namespace,
          OKActions: m.okActions,
          Period: m.period,
          Statistic: m.statistic?.toString(),
          Threshold: m.threshold,
          ThresholdMetricId: m.thresholdMetricId,
          TreatMissingData: m.treatMissingData?.toString(),
          Unit: m.unit?.toString(),
        };
        await this.putMetricAlarm(client.cloudwatchClient, input);
        out.push(m);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        // check specific metric
        const { metricName, region } = this.idFields(id);
        if (enabledRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawMetric = await this.getMetricAlarm(client.cloudwatchClient, metricName);
          if (rawMetric && rawMetric.length > 0) return this.metricAlarmMapper(rawMetric[0], region);
        }
      } else {
        const out: MetricAlarm[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const metricAlarms = (await this.getMetricAlarms(client.cloudwatchClient)) ?? [];
            for (const i of metricAlarms) {
              const m = this.metricAlarmMapper(i, region);
              if (m) out.push(m);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (mas: MetricAlarm[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const m of mas) {
        const cloudRecord = ctx?.memo?.cloud?.MetricAlarm?.[this.entityId(m)];
        const isUpdate = Object.is(this.module.metricAlarm.cloud.updateOrReplace(cloudRecord, m), 'update');
        if (isUpdate) {
          // in the case of objects being modified, restore them
          if (!Object.is(m.alarmArn, cloudRecord.alarmArn)) {
            cloudRecord.id = m.id;
            await this.module.metricAlarm.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          } else {
            if (!m.alarmName) throw new Error('Cannot update a metric alarm without a name');

            const input: PutMetricAlarmCommandInput = {
              ActionsEnabled: m.actionsEnabled,
              AlarmActions: m.alarmActions,
              AlarmDescription: m.alarmDescription,
              AlarmName: m.alarmName,
              ComparisonOperator: m.comparisonOperator?.toString(),
              DatapointsToAlarm: m.datapointsToAlarm,
              Dimensions: m.dimensions,
              EvaluateLowSampleCountPercentile: m.evaluateLowSampleCountPercentile?.toString(),
              EvaluationPeriods: m.evaluationPeriods,
              ExtendedStatistic: m.extendedStatistic,
              InsufficientDataActions: m.insufficientDataActions,
              MetricName: m.metricName,
              Metrics: m.metrics,
              Namespace: m.namespace,
              OKActions: m.okActions,
              Period: m.period,
              Statistic: m.statistic?.toString(),
              Threshold: m.threshold,
              ThresholdMetricId: m.thresholdMetricId,
              TreatMissingData: m.treatMissingData?.toString(),
              Unit: m.unit?.toString(),
            };
            await this.putMetricAlarm(client.cloudwatchClient, input);
            out.push(m);
          }
        }
      }
      return out;
    },
    delete: async (ms: MetricAlarm[], ctx: Context) => {
      for (const m of ms) {
        const client = (await ctx.getAwsClient(m.region)) as AWS;
        await this.deleteMetricAlarm(client.cloudwatchClient, m.alarmName);
      }
    },
  });

  constructor(module: AwsCloudwatchModule) {
    super();
    this.module = module;
    super.init();
  }
}
