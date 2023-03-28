import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { DhcpOptions } from './dhcp_options';

/**
 * @enum
 * Different states for the VPC. It can be 'available' or 'pending'
 */
export enum VpcState {
  AVAILABLE = 'available',
  PENDING = 'pending',
}

/**
 * Table to manage AWS VPC entries.
 * Amazon Virtual Private Cloud (Amazon VPC) gives you full control over your virtual networking
 * environment, including resource placement, connectivity, and security.
 *
 * @see https://aws.amazon.com/vpc/
 */
@Unique('uq_vpc_region', ['id', 'region'])
@Unique('uq_vpc_id_region', ['vpcId', 'region'])
@Entity()
export class Vpc {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ID used to identify the VPC
   */
  @Column({
    nullable: true,
  })
  @cloudId
  vpcId?: string;

  /**
   * @public
   * Amazon VPC supports IPv4 and IPv6 addressing. A VPC must have an IPv4 CIDR block associated with it.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/configure-your-vpc.html#vpc-cidr-blocks
   */
  @Column()
  cidrBlock: string;

  /**
   * @public
   * Current state for the VPC
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: VpcState,
  })
  state?: VpcState;

  /**
   * @public
   * Whether this VPC is the default one
   * When you start using Amazon VPC, you have a default VPC in each AWS Region.
   * A default VPC comes with a public subnet in each Availability Zone,
   * an internet gateway, and settings to enable DNS resolution.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/default-vpc.html
   */
  @Column({
    default: false,
  })
  isDefault: boolean;

  /**
   * @public
   * Determines whether the VPC supports assigning public DNS hostnames to instances with public IP addresses.
   * The default for this attribute is false unless the VPC is a default VPC.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/vpc-dns.html#vpc-dns-hostnames
   */
  @Column({
    default: false,
  })
  enableDnsHostnames: boolean;

  /**
   * @public
   * Determines whether the VPC supports DNS resolution through the Amazon provided DNS server.
   * If this attribute is true, queries to the Amazon provided DNS server succeed.
   * For more information, see Amazon DNS server. The default for this attribute is true.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/vpc-dns.html#vpc-dns-hostnames
   */
  @Column({
    default: false,
  })
  enableDnsSupport: boolean;

  /**
   * @public
   * Defines if Network Address Usage (NAU) is enabled. NAU is a metric applied to resources
   * in your virtual network to help you plan for and monitor the size of your VPC.
   * Each NAU unit contributes to a total that represents the size of your VPC.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/network-address-usage.html
   */
  @Column({
    default: false,
  })
  enableNetworkAddressUsageMetrics: boolean;

  /**
   * @public
   * Complex type to provide identifier tags for the VPC
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  /**
   * @public
   * The set of DHCP options you've associated with the VPC
   */
  @ManyToOne(() => DhcpOptions, {
    eager: true,
    nullable: true,
  })
  @JoinColumn([
    {
      name: 'dhcp_options_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  dhcpOptions?: DhcpOptions;

  /**
   * @public
   * Reference to the region where it belongs
   */
  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
