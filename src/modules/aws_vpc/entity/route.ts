import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { RouteTable } from './route_table';

/**
 * Table to manage AWS routes. A route table contains a set of rules, called routes,
 * that determine where network traffic from your subnet or gateway is directed.
 *
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/route-table-options.html
 */
@Entity()
export class Route {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * Reference to the route table associated with this route
   */
  @ManyToOne(() => RouteTable, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn()
  routeTable: RouteTable;

  /**
   * @public
   * destination fields: used to determine the destination to be matched
   */
  @Column({ nullable: true })
  @cloudId
  DestinationCidrBlock?: string;

  /**
   * @public
   * destination fields: used to determine the destination to be matched (ipv6)
   */
  @Column({ nullable: true })
  @cloudId
  DestinationIpv6CidrBlock?: string;

  /**
   * @public
   * A managed prefix list is a set of one or more CIDR blocks.
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/managed-prefix-lists.html
   */
  @Column({ nullable: true })
  @cloudId
  DestinationPrefixListId?: string;

  /**
   * @public
   * Egress-only Internet Gateway is VPC component that allows outbound only communication to the
   * internet over IPv6, and prevents the Internet from initiating an IPv6 connection with your instances.
   */
  @Column({ nullable: true })
  @cloudId
  EgressOnlyInternetGatewayId?: string;

  /**
   * @public
   * ID for the gateway used to connect to internet
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html
   */
  @Column({ nullable: true })
  @cloudId
  GatewayId?: string;

  /**
   * @public
   * ID for the referenced EC2 instance
   */
  @Column({ nullable: true })
  @cloudId
  InstanceId?: string;

  /**
   * @public
   * ID for the EC2 instance owner
   */
  @Column({ nullable: true })
  @cloudId
  InstanceOwnerId?: string;

  /**
   * @public
   * ID for the NAT gateway referenced by the route
   */
  @Column({ nullable: true })
  @cloudId
  NatGatewayId?: string;

  /**
   * @public
   * ID for the transit gateway used by the route
   */
  @Column({ nullable: true })
  @cloudId
  TransitGatewayId?: string;

  /**
   * @public
   * ID for the local gateway used by the route
   */
  @Column({ nullable: true })
  @cloudId
  LocalGatewayId?: string;

  /**
   * @public
   * ID for the carrier gateway used by the route
   */
  @Column({ nullable: true })
  @cloudId
  CarrierGatewayId?: string;

  /**
   * @public
   * ID for the network interface gateway gateway used by the route
   */
  @Column({ nullable: true })
  @cloudId
  NetworkInterfaceId?: string;

  /**
   * @public
   * ID for the VPC peering connection used by the route
   */
  @Column({ nullable: true })
  @cloudId
  VpcPeeringConnectionId?: string;

  /**
   * @public
   * AWS ARN to identify the network for the route
   */
  @Column({ nullable: true })
  @cloudId
  CoreNetworkArn?: string;
}
