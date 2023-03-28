import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { AvailabilityZone } from './availability_zone';
import { NetworkAcl } from './network_acl';
import { RouteTableAssociation } from './route_table_association';
import { Vpc } from './vpc';

/**
 * @enum
 * Different states for the subnet. It can be 'available' or 'pending'
 */
export enum SubnetState {
  AVAILABLE = 'available',
  PENDING = 'pending',
}

/**
 * Table to manage AWS subnet entries.
 * A subnet is a range of IP addresses in your VPC. You can launch AWS resources into a specified subnet.
 * Use a public subnet for resources that must be connected to the internet, and a private subnet for
 * resources that won't be connected to the internet.
 *
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html
 */
@Unique('uq_subnet_region', ['id', 'region'])
@Unique('uq_subnet_id_region', ['subnetId', 'region'])
@Entity()
export class Subnet {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Reference to the availability zone associated with this subnet
   */
  @ManyToOne(() => AvailabilityZone, { nullable: false, eager: true })
  @JoinColumn([
    {
      name: 'availability_zone',
      referencedColumnName: 'name',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  availabilityZone: AvailabilityZone;

  /**
   * @public
   * Current state of the subnet
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: SubnetState,
  })
  state?: SubnetState;

  /**
   * @public
   * Reference to the VPC associated with this subnet
   */
  @ManyToOne(() => Vpc, { nullable: false, eager: true, onDelete: 'CASCADE' })
  @JoinColumn([
    {
      name: 'vpc_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  vpc: Vpc;

  /**
   * @public
   * The number of IPv4 addresses in the subnet that are available.
   */
  @Column({
    nullable: true,
    type: 'int',
  })
  availableIpAddressCount?: number;

  /**
   * @public
   * The IPv4 CIDR block of the subnet. The CIDR block you specify must exactly match the subnet's CIDR block
   * for information to be returned for the subnet. You can also use cidr or cidrBlock as the filter names.
   */
  @Column({
    nullable: true,
  })
  cidrBlock?: string;

  /**
   * @public
   * AWS ID used to identify the subnet
   */
  @Column({
    nullable: true,
  })
  @cloudId
  subnetId?: string;

  /**
   * @public
   * The AWS account ID for the owner of this subnet
   */
  @Column({
    nullable: true,
  })
  ownerId?: string;

  /**
   * @public
   * AWS ARN used to identify the subnet
   */
  @Column({
    nullable: true,
  })
  subnetArn?: string;

  /**
   * @public
   * Reference to the route table associations for this subnet
   */
  @OneToMany(() => RouteTableAssociation, rta => rta.routeTable, {
    nullable: true,
  })
  explicitRouteTableAssociations?: RouteTableAssociation[];

  /**
   * @public
   * Reference to the network ACL associated to that subnet
   */
  @ManyToOne(() => NetworkAcl, { nullable: true, eager: true, onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn([
    {
      name: 'network_acl_id',
      referencedColumnName: 'id',
    },
    // we defined this one to make sure we are using the right region
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  networkAcl?: NetworkAcl;

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
