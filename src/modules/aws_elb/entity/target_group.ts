import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Vpc } from '../../aws_vpc/entity';

/**
 * @enum
 * Different types of target you specify when registering targets with this target group.
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#target-type
 */
export enum TargetTypeEnum {
  ALB = 'alb',
  INSTANCE = 'instance',
  IP = 'ip',
  LAMBDA = 'lambda',
}

/**
 * @enum
 * Whether to expose ipv4 or ipv6
 */
export enum TargetGroupIpAddressTypeEnum {
  IPV4 = 'ipv4',
  IPV6 = 'ipv6',
}

/**
 * @enum
 * Different types of protocols for the target group
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_CreateTargetGroup.html
 */
export enum ProtocolEnum {
  GENEVE = 'GENEVE',
  HTTP = 'HTTP',
  HTTPS = 'HTTPS',
  TCP = 'TCP',
  TCP_UDP = 'TCP_UDP',
  TLS = 'TLS',
  UDP = 'UDP',
}

/**
 * @enum
 * Protocol versions for the target group
 * Onlye "GRPC", "HTTP1" and "HTTP2" are supported
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#target-group-protocol-version
 */
export enum ProtocolVersionEnum {
  GRPC = 'GRPC',
  HTTP1 = 'HTTP1',
  HTTP2 = 'HTTP2',
}

/**
 * Table to manage AWS Target groups. Each target group is used to route requests to one or more registered targets.
 * When you create each listener rule, you specify a target group and conditions. When a rule condition is met, traffic is forwarded to the corresponding target group
 *
 * @example
 * ```sql
 * INSERT INTO target_group (target_group_name, target_type, protocol, port, vpc, health_check_path)
 * VALUES ('tg_name', 'ip', 'HTTP', 5678, null, '/health');
 * SELECT * FROM target_group WHERE target_group_name = 'tg_name';
 * DELETE FROM target_group WHERE target_group_name = 'tg_name';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-elb-integration.ts#L126
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html
 */
@Entity()
@Index(['targetGroupName', 'region'], { unique: true })
export class TargetGroup {
  /**
   * @private
   * Auto-incremented ID field for storing builds
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name to identify the target group
   */
  @Column()
  targetGroupName: string;

  /**
   * @public
   * Type of target group to create
   */
  @Column({
    type: 'enum',
    enum: TargetTypeEnum,
  })
  targetType: TargetTypeEnum;

  /**
   * @public
   * AWS ARN to identify the target group
   */
  @Column({
    nullable: true,
  })
  @cloudId
  targetGroupArn?: string;

  /**
   * @public
   * Whether to expose ipv4 or ipv6
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: TargetGroupIpAddressTypeEnum,
  })
  ipAddressType?: TargetGroupIpAddressTypeEnum;

  /**
   * @public
   * Protocol for the target group
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: ProtocolEnum,
  })
  protocol?: ProtocolEnum;

  /**
   * @public
   * Port to expose
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  port?: number;

  /**
   * @public
   * Reference to the associated VPC
   * If the target is a Lambda function, this parameter does not apply. Otherwise, this parameter is required.
   */
  @ManyToOne(() => Vpc, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'vpc',
  })
  vpc?: Vpc;

  /**
   * @public
   * The protocol the load balancer uses when performing health checks on targets.
   * The possible protocols are HTTP and HTTPS. The default is the HTTP protocol.
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: ProtocolEnum,
  })
  healthCheckProtocol?: ProtocolEnum;

  /**
   * @public
   * The port the load balancer uses when performing health checks on targets. The default is to use the port
   * on which each target receives traffic from the load balancer.
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
   */
  @Column({
    nullable: true,
  })
  healthCheckPort?: string;

  /**
   * @public
   * Whether to enable healthchecks for this target group
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
   */
  @Column({
    nullable: true,
  })
  healthCheckEnabled?: boolean;

  /**
   * @public
   * The approximate amount of time, in seconds, between health checks of an individual target.
   * The range is 5–300 seconds. The default is 30 seconds if the target type is instance or ip and 35
   * seconds if the target type is lambda.
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  healthCheckIntervalSeconds?: number;

  /**
   * @public
   * The amount of time, in seconds, during which no response from a target means a failed health check.
   * The range is 2–120 seconds. The default is 5 seconds if the target type is instance or ip and
   * 30 seconds if the target type is lambda.
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  healthCheckTimeoutSeconds?: number;

  /**
   * @public
   * The number of consecutive successful health checks required before considering an unhealthy target healthy.
   * The range is 2–10. The default is 5.
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  healthyThresholdCount?: number;

  /**
   * @public
   * The number of consecutive failed health checks required before considering a target unhealthy.
   * The range is 2–10. The default is 2.
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  unhealthyThresholdCount?: number;

  /**
   * @public
   * The destination for health checks on the targets.
   * If the protocol version is HTTP/1.1 or HTTP/2, specify a valid URI (/path?query). The default is /.
   * If the protocol version is gRPC, specify the path of a custom health check method with the format /package.service/method.
   * The default is /AWS.ALB/healthcheck.
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
   */
  @Column({
    nullable: true,
  })
  healthCheckPath?: string;

  /**
   * @public
   * Protocol version for the target group
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: ProtocolVersionEnum,
  })
  protocolVersion?: ProtocolVersionEnum;

  /**
   * @public
   * Region for the target group
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;
}
