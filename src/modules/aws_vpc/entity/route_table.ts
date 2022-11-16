import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { Route } from './route';
import { RouteTableAssociation } from './route_table_association';
import { Vpc } from './vpc';

@Entity()
export class RouteTable {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @cloudId
  routeTableId?: string;

  @ManyToOne(() => Vpc, {
    nullable: false,
    eager: true,
  })
  @JoinColumn()
  vpc: Vpc;

  @OneToMany(() => RouteTableAssociation, rta => rta.routeTable, {
    eager: true,
    nullable: true,
  })
  explicitSubnetAssociations?: RouteTableAssociation[];

  @OneToMany(() => Route, route => route.routeTable, {
    eager: true,
    cascade: true,
    nullable: true,
  })
  routes?: Route[];

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };
}
