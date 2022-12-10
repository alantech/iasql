import { Check, Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { ElasticIp } from './elastic_ip';
import { Subnet } from './subnet';

/**
 * @enum
 * Different connectivity types for the NAT gateway. Can be 'private' or 'public'
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
 */
export enum ConnectivityType {
  PRIVATE = 'private',
  PUBLIC = 'public',
}

/**
 * @enum
 * Different states for the NAT gateway instances
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
 */
export enum NatGatewayState {
  AVAILABLE = 'available',
  DELETED = 'deleted',
  DELETING = 'deleting',
  FAILED = 'failed',
  PENDING = 'pending',
}

/**
 * Table to manage AWS NAT Gateway instances.
 * A NAT gateway is a Network Address Translation (NAT) service.
 * You can use a NAT gateway so that instances in a private subnet can connect to services
 * outside your VPC but external services cannot initiate a connection with those instances.
 *
 * @example
 * ```sql
 * INSERT INTO nat_gateway (connectivity_type, subnet_id, tags) SELECT 'private', id, '{"Name":"nat_gateway"}
 * FROM subnet WHERE cidr_block = '191.0.0.0/16';
 * SELECT * FROM nat_gateway WHERE tags ->> 'name' = 'nat_gateway';
 * DELETE FROM nat_gateway WHERE tags ->> 'name' = 'nat_gateway';
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-vpc-integration.ts#L337
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
 */
@Check(
  'Check_elastic_ip_when_public',
  `("elastic_ip_id" is not null AND "connectivity_type" = 'public') OR "elastic_ip_id" is null`,
)
@Entity()
export class NatGateway {
  /**
   * @private
   * Auto-incremented ID field for the endpoint
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ID to identify the NAT gateway
   */
  @Column({ nullable: true })
  @cloudId
  natGatewayId?: string;

  /**
   * @public
   * Reference to the associated subnets for the NAT gateway
   * @see https://aws.amazon.com/premiumsupport/knowledge-center/nat-gateway-vpc-private-subnet/
   */
  @ManyToOne(() => Subnet, { nullable: false, eager: true })
  @JoinColumn([
    {
      name: 'subnet_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  subnet?: Subnet;

  /**
   * @public
   * Connectivity type for this NAT gateway
   */
  @Column({
    type: 'enum',
    enum: ConnectivityType,
  })
  connectivityType: ConnectivityType;

  /**
   * @public
   * Reference to the elastic IP used by this NAT gateway
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
   */
  @OneToOne(() => ElasticIp, {
    nullable: true,
    eager: true,
  })
  @JoinColumn([
    {
      name: 'elastic_ip_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  elasticIp?: ElasticIp;

  /**
   * @public
   * Current state for the gateway
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: NatGatewayState,
  })
  state?: NatGatewayState;

  /**
   * @public
   * Complex type to provide identifier tags for the gateway
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

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
