import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { AwsRegions } from '../../aws_account/entity';
import { RouteTable } from './route_table';

/**
 * Table to manage AWS routes. A route table contains a set of rules, called routes,
 * that determine where network traffic from your subnet or gateway is directed.
 *
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/route-table-options.html
 */
@Unique('uq_route_table_destination', ['routeTable', 'destination'])
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
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn([
    {
      name: 'route_table_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  routeTable: RouteTable;

  /**
   * @public
   * destination field: used to determine the destination to be matched. Could be an IPv4 or IPv6 CIDR block or a prefixed list
   */
  @Check(`
    "destination" ~ '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/(3[0-2]|[12][0-9]|[0-9])$'
    OR "destination" LIKE 'pl-%'
    OR "destination" ~ '^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$'
  `)
  @Column({ nullable: false })
  destination: string;

  /**
   * @public
   * Egress-only Internet Gateway is VPC component that allows outbound only communication to the
   * internet over IPv6, and prevents the Internet from initiating an IPv6 connection with your instances.
   */
  @Column({ nullable: true })
  egressOnlyInternetGatewayId?: string;

  /**
   * @public
   * ID for the gateway used to connect to internet
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html
   */
  @Column({ nullable: true })
  gatewayId?: string;

  /**
   * @public
   * ID for the referenced EC2 instance
   */
  @Column({ nullable: true })
  instanceId?: string;

  /**
   * @public
   * ID for the EC2 instance owner
   */
  @Column({ nullable: true })
  instanceOwnerId?: string;

  /**
   * @public
   * ID for the NAT gateway referenced by the route
   */
  @Column({ nullable: true })
  natGatewayId?: string;

  /**
   * @public
   * ID for the transit gateway used by the route
   */
  @Column({ nullable: true })
  transitGatewayId?: string;

  /**
   * @public
   * ID for the local gateway used by the route
   */
  @Column({ nullable: true })
  localGatewayId?: string;

  /**
   * @public
   * ID for the carrier gateway used by the route
   */
  @Column({ nullable: true })
  carrierGatewayId?: string;

  /**
   * @public
   * ID for the network interface gateway gateway used by the route
   */
  @Column({ nullable: true })
  networkInterfaceId?: string;

  /**
   * @public
   * ID for the VPC peering connection used by the route
   */
  @Column({ nullable: true })
  vpcPeeringConnectionId?: string;

  /**
   * @public
   * AWS ARN to identify the network for the route
   */
  @Column({ nullable: true })
  coreNetworkArn?: string;

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
  region: string;
}
