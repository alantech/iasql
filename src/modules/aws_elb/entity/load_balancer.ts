import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { LoadBalancerAttribute } from '@aws-sdk/client-elastic-load-balancing-v2';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { SecurityGroup } from '../../aws_security_group/entity';
import { Vpc } from '../../aws_vpc/entity';

/**
 * @enum
 * Different types of available schemas
 * An internet-facing load balancer routes requests from clients to targets over the internet.
 * An internal load balancer routes requests to targets using private IP addresses.
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/network/create-network-load-balancer.html
 */
export enum LoadBalancerSchemeEnum {
  INTERNAL = 'internal',
  INTERNET_FACING = 'internet-facing',
}

/**
 * @enum
 * Defines the different possible stats for a load balancer
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_LoadBalancerState.html
 */
export enum LoadBalancerStateEnum {
  ACTIVE = 'active',
  ACTIVE_IMPAIRED = 'active_impaired',
  FAILED = 'failed',
  PROVISIONING = 'provisioning',
}

/**
 * @enum
 * Different types of load balancers
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html
 * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/gateway/introduction.html
 */
export enum LoadBalancerTypeEnum {
  APPLICATION = 'application',
  GATEWAY = 'gateway',
  NETWORK = 'network',
}

/**
 * @enum
 * Modes of exposing IPs on the load balancer
 * use "dualstack" for exposing both IPv4 and IPv6 addresses
 * @see https://aws.amazon.com/premiumsupport/knowledge-center/elb-configure-with-ipv6/
 */
export enum IpAddressType {
  DUALSTACK = 'dualstack',
  IPV4 = 'ipv4',
}

/**
 * Table to manage AWS Load Balancers
 *
 * @example
 * ```sql
 * INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
 * VALUES ('load_balancer', 'internet-facing', null, 'application', 'ipv4');
 * SELECT * FROM load_balancer WHERE load_balancer_name = 'load_balancer';
 * DELETE FROM load_balancer WHERE load_balancer_name = 'load_balancer';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/b2c2383b73d73f5cdf75c867d334e80cdf40caa1/test/modules/aws-elb-integration.ts#L221
 * @see https://aws.amazon.com/elasticloadbalancing/
 */
@Entity()
@Check(
  'check_load_balancer_availability_zones',
  'check_load_balancer_availability_zones(load_balancer_name, availability_zones)',
)
@Check('check_load_balancer_subnets', 'check_load_balancer_subnets(subnets)')
@Index(['loadBalancerName', 'region'], { unique: true })
export class LoadBalancer {
  /**
   * @private
   * Auto-incremented ID field for storing builds
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Name to identify the load balancer
   */
  @Column()
  loadBalancerName: string;

  /**
   * @public
   * AWS ARN that identifies the load balancer
   */
  @Column({
    nullable: true,
  })
  @cloudId
  loadBalancerArn?: string;

  /**
   * @public
   * Custom domain name to associate with your load balancer.
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/using-domain-names-with-elb.html
   */
  @Column({
    nullable: true,
  })
  dnsName?: string;

  /**
   * @public
   * Hosted zone to route traffic to the load balancer
   * @see https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-elb-load-balancer.html
   */
  @Column({
    nullable: true,
  })
  canonicalHostedZoneId?: string;

  /**
   * @public
   * Creation date
   */
  @Column({
    nullable: true,
    type: 'timestamp with time zone',
  })
  createdTime?: Date;

  /**
   * @public
   * Schema for the load balancer
   */
  @Column({
    type: 'enum',
    enum: LoadBalancerSchemeEnum,
  })
  scheme: LoadBalancerSchemeEnum;

  /**
   * @public
   * Current status of the load balancer
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: LoadBalancerStateEnum,
  })
  state?: LoadBalancerStateEnum;

  /**
   * @public
   * Type of load balancer
   */
  @Column({
    type: 'enum',
    enum: LoadBalancerTypeEnum,
  })
  loadBalancerType: LoadBalancerTypeEnum;

  /**
   * @public
   * Reference to the VPC associated with the load balancer
   * @see https://aws.amazon.com/blogs/aws/new-aws-elastic-load-balancing-inside-of-a-virtual-private-cloud/
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
   * Reference to the associated subnets for a load balancer
   * @see https://docs.aws.amazon.com/prescriptive-guidance/latest/load-balancer-stickiness/subnets-routing.html
   */
  @Column('varchar', { array: true, nullable: true })
  subnets?: string[];

  /**
   * @public
   * Reference to the associated availability zones for the load balancer
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/enable-disable-az.html
   */
  @Column('varchar', { array: true, nullable: true })
  availabilityZones?: string[];

  /**
   * @public
   * Reference to the associated security groups for the load balancer
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-update-security-groups.html
   */
  @ManyToMany(() => SecurityGroup, { eager: true })
  @JoinTable({
    name: 'load_balancer_security_groups',
  })
  securityGroups?: SecurityGroup[];

  /**
   * @public
   * Whether to expose ipv4 or dual stack
   */
  @Column({
    type: 'enum',
    enum: IpAddressType,
  })
  ipAddressType: IpAddressType;

  /**
   * @public
   * Reference to an specific pool of address for ipv4
   * @see https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_LoadBalancer.html
   */
  @Column({
    nullable: true,
  })
  customerOwnedIpv4Pool?: string;

  /**
   * @public
   * Region for the load balancer
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  region: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  attributes?: LoadBalancerAttribute[];
}
