import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { Route as AwsRoute } from '@aws-sdk/client-ec2';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { RouteTableAssociation } from './route_table_association';
import { Vpc } from './vpc';

/**
 * Table to manage AWS route tables.
 * A route table contains a set of rules, called routes, that determine where network traffic from your subnet or gateway is directed.
 *
 * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html
 */
@Unique('uq_route_table_region', ['id', 'region'])
@Entity()
export class RouteTable {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS ID to identify the route table
   */
  @Column({ nullable: true })
  @cloudId
  routeTableId?: string;

  /**
   * @public
   * Reference to the VPC associated with this route table
   */
  @ManyToOne(() => Vpc, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE',
  })
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
   * Reference to all the associations for this route table
   */
  @OneToMany(() => RouteTableAssociation, rta => rta.routeTable, {})
  associations: RouteTableAssociation[];

  /**
   * @public
   * Complex type to provide identifier tags for the route table
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

  /**
   * @internal
   * Reference to raw routes coming from AWS to reduce calls to AWS API
   * Not meant to be part of the DB schema but useful in the engine code
   */
  routes: AwsRoute[];
}
