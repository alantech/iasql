import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';

/**
 * @enum
 * The arithmetic operation to use when comparing the specified statistic and threshold
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#comparisonoperator
 */
export enum comparisonOperatorEnum {
  GreaterThanOrEqualToThreshold = 'GreaterThanOrEqualToThreshold',
  GreaterThanThreshold = 'GreaterThanThreshold',
  GreaterThanUpperThreshold = 'GreaterThanUpperThreshold',
  LessThanLowerOrGreaterThanUpperThreshold = 'LessThanLowerOrGreaterThanUpperThreshold',
  LessThanLowerThreshold = 'LessThanLowerThreshold',
  LessThanOrEqualToThreshold = 'LessThanOrEqualToThreshold',
  LessThanThreshold = 'LessThanThreshold',
}

/**
 * @enum
 * Values about how to evaluate low sample count percentile
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#evaluatelowsamplecountpercentile
 */
export enum evaluateLowSampleCountPercentileEnum {
  evaluate = 'evaluate',
  ignore = 'ignore',
}

/**
 * @enum
 * The unit of measure for the statistic.
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/enums/standardunit.html
 */
export enum standardUnitEnum {
  Bits = 'Bits',
  Bits_Second = 'Bits/Second',
  Bytes = 'Bytes',
  Bytes_Second = 'Bytes/Second',
  Count = 'Count',
  Count_Second = 'Count/Second',
  Gigabits = 'Gigabits',
  Gigabits_Second = 'Gigabits/Second',
  Gigabytes = 'Gigabytes',
  Gigabytes_Second = 'Gigabytes/Second',
  Kilobits = 'Kilobits',
  Kilobits_Second = 'Kilobits/Second',
  Kilobytes = 'Kilobytes',
  Kilobytes_Second = 'Kilobytes/Second',
  Megabits = 'Megabits',
  Megabits_Second = 'Megabits/Second',
  Megabytes = 'Megabytes',
  Megabytes_Second = 'Megabytes/Second',
  Microseconds = 'Microseconds',
  Milliseconds = 'Milliseconds',
  None = 'None',
  Percent = 'Percent',
  Seconds = 'Seconds',
  Terabits = 'Terabits',
  Terabits_Second = 'Terabits/Second',
  Terabytes = 'Terabytes',
  Terabytes_Second = 'Terabytes/Second',
}

/**
 * @enum
 * The statistic for the metric specified in MetricName, other than percentile.
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#statistic
 */
export enum statisticEnum {
  Average = 'Average',
  Maximum = 'Maximum',
  Minimum = 'Minimum',
  SampleCount = 'SampleCount',
  Sum = 'Sum',
}

/**
 * @enum
 * Sets how this alarm is to handle missing data points.
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#treatmissingdata
 */
export enum treatMissingDataEnum {
  breaching = 'breaching',
  notBreaching = 'notBreaching',
  ignore = 'ignore',
  missing = 'missing',
}

/**
 * Table to query for all AWS Cloudwatch metric alarms in the system.
 * You can use Amazon CloudWatch Logs to monitor,store, and access your log files
 * from Amazon Elastic Compute Cloud (Amazon EC2) instances,
 * AWS CloudTrail, Route 53, and other sources.
 *
 * A metric alarm watches a single CloudWatch metric or the result of a math expression
 * based on CloudWatch metrics. The alarm performs one or more actions based on the
 * value of the metric or expression relative to a threshold over a number of time periods.
 * The action can be sending a notification to an Amazon SNS topic, performing an Amazon EC2
 * action or an Amazon EC2 Auto Scaling action, or creating an OpsItem or incident in Systems Manager.
 *
 * @example
 * ```sql TheButton[Manage a CloudWatch Metric alarm entry]="Manage a CloudWatch Metric alarm entry"
 * INSERT INTO log_group (log_group_name) VALUES ('log_name');
 *
 * SELECT * FROM log_group WHERE log_group_name = 'log_name';
 *
 * DELETE FROM log_group WHERE log_group_name = 'log_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-cloudwatch-integration.ts#L309
 * @see https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html
 *
 */
@Entity()
@Index(['alarmName', 'region'], { unique: true })
export class MetricAlarm {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Alarm name
   */
  @cloudId
  @Column()
  alarmName: string;

  /**
   * @public
   * The Amazon Resource Name (ARN) of the alarm.
   */
  @Column({
    nullable: true,
  })
  alarmArn: string;

  /**
   * @public
   * The description for the alarm
   */
  @Column({
    nullable: true,
  })
  alarmDescription?: string;

  /**
   * @public
   * Indicates whether actions should be executed during any changes to the alarm state
   */
  @Column({
    default: true,
  })
  actionsEnabled?: boolean;

  /**
   * @public
   * The actions to execute when this alarm transitions to the ALARM state from any other state.
   * Each action is specified as an Amazon Resource Name (ARN).
   */
  @Column({ type: 'json', nullable: true })
  alarmActions?: string[];

  /**
   * @public
   * The arithmetic operation to use when comparing the specified statistic and threshold.
   * The specified statistic value is used as the first operand.
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: comparisonOperatorEnum,
  })
  comparisonOperator?: comparisonOperatorEnum;

  /**
   * @public
   * The number of data points that must be breaching to trigger the alarm.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#datapointstoalarm
   */
  @Column({
    nullable: true,
  })
  datapointsToAlarm?: number;

  /**
   * @public
   * The dimensions for the metric specified in MetricName
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/dimension.html
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  dimensions: {
    Name: string | undefined;
    Value: string | undefined;
  }[];

  /**
   * @public
   * Used only for alarms based on percentiles
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#evaluatelowsamplecountpercentile
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: evaluateLowSampleCountPercentileEnum,
  })
  evaluateLowSampleCountPercentile?: evaluateLowSampleCountPercentileEnum;

  /**
   * @public
   * The number of periods over which data is compared to the specified threshold.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#evaluationperiods
   */
  @Column({
    nullable: true,
  })
  evaluationPeriods?: number;

  /**
   * @public
   * The percentile statistic for the metric specified in MetricName.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarmcommandinput.html#extendedstatistic
   */
  @Column({
    nullable: true,
  })
  extendedStatistic?: string;

  /**
   * @public
   * The actions to execute when this alarm transitions to the INSUFFICIENT_DATA state from any other state.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#insufficientdataactions
   */
  @Column({ type: 'json', nullable: true })
  insufficientDataActions?: string[];

  /**
   * @public
   * The name for the metric associated with the alarm.
   */
  @Column({
    nullable: true,
  })
  metricName?: string;

  /**
   * @public
   * An array of MetricDataQuery structures that enable you to create an alarm based on the result of a metric math expression.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#metrics
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  metrics: {
    Id: string | undefined;
    MetricStat?: {
      Metric:
        | {
            Namespace?: string;
            MetricName?: string;
            Dimensions?: {
              Name: string | undefined;
              Value: string | undefined;
            }[];
          }
        | undefined;
      Period: number | undefined;
      Stat: string | undefined;
      Unit?: standardUnitEnum | string;
    };
    Expression?: string;
    Label?: string;
    ReturnData?: boolean;
    Period?: number;
    AccountId?: string;
  }[];

  /**
   * @public
   * The namespace for the metric associated specified in MetricName.
   */
  @Column({
    nullable: true,
  })
  namespace?: string;

  /**
   * @public
   * The actions to execute when this alarm transitions to an OK state from any other state.
   */
  @Column({ type: 'json', nullable: true })
  okActions?: string[];

  /**
   * @public
   * The length, in seconds, used each time the metric specified in MetricName is evaluated.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#period
   */
  @Column({
    nullable: true,
  })
  period?: number;

  /**
   * @public
   * The statistic for the metric specified in MetricName, other than percentile.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#statistic
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: statisticEnum,
  })
  statistic?: statisticEnum;

  /**
   * @public
   * The value against which the specified statistic is compared.
   */
  @Column({
    nullable: true,
  })
  threshold?: number;

  /**
   * @public
   * If this is an alarm based on an anomaly detection model, make this value match the ID of the ANOMALY_DETECTION_BAND function.
   */
  @Column({
    nullable: true,
  })
  thresholdMetricId?: string;

  /**
   * @public
   * Sets how this alarm is to handle missing data points.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#treatmissingdata
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: treatMissingDataEnum,
  })
  treatMissingData?: treatMissingDataEnum;

  /**
   * @public
   * The unit of measure for the statistic.
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudwatch/interfaces/putmetricalarminput.html#unit
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: standardUnitEnum,
  })
  unit?: standardUnitEnum;

  /**
   * @public
   * Region for the alarm
   */
  @cloudId
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
