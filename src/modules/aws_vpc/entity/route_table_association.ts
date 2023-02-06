import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { RouteTable } from './route_table';
import { Subnet } from './subnet';
import { Vpc } from './vpc';

/**
 * Table to manage associations between a Route and a Route table.
 *
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/WorkWithRouteTables.html
 */
@Unique('uq_routetable_routetable_subnet_ismain', ['vpc', 'subnet', 'isMain'])
@Entity()
export class RouteTableAssociation {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ID to identify the route table association
   */
  @Column({ nullable: true })
  @cloudId
  routeTableAssociationId?: string;

  /**
   * @public
   * Reference to the route table for this association
   */
  @ManyToOne(() => RouteTable, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({ name: 'route_table_id' })
  routeTable: RouteTable;

  /**
   * @public
   * Your VPC has an implicit router, and you use route tables to control where network traffic is directed.
   * Each subnet in your VPC must be associated with a route table, which controls the routing for the subnet
   * (subnet route table).
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html#subnet-route-tables
   */
  @ManyToOne(() => Subnet, {
    nullable: true,
    eager: true,
  })
  @JoinColumn()
  subnet?: Subnet;

  /**
   * @public
   * Reference to the VPC for this association
   */
  @ManyToOne(() => Vpc, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  vpc: Vpc;

  /**
   * @public
   * Whether this is the main route association
   * Main is the route table that automatically comes with your VPC.
   * It controls the routing for all subnets that are not explicitly associated with any other route table.
   */
  @Column({ default: false })
  isMain: boolean;

  // TODO: add the check so that if isMain = true, then the subnet should not be set

  // @Column()
  // associationState: string;
}
