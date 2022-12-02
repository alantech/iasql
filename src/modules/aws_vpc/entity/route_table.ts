import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Route } from './route';
import { RouteTableAssociation } from './route_table_association';
import { Vpc } from './vpc';

@Unique('uq_route_table_vpc', ['id', 'vpcId'])
@Entity()
export class RouteTable {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @cloudId
  routeTableId?: string;

  @Column({ nullable: false })
  vpcId: number;

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

  @OneToMany(() => RouteTableAssociation, rta => rta.routeTable, {})
  associations: RouteTableAssociation[];

  @OneToMany(() => Route, route => route.routeTable, {
    eager: true,
    cascade: true,
    orphanedRowAction: 'delete',
  })
  routes: Route[];

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

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
