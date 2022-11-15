import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { Route } from './route';
import { Subnet } from './subnet';
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

  @ManyToMany(() => Subnet, { eager: true, nullable: true })
  @JoinTable({
    name: 'endpoint_interface_subnets',
  })
  explicitlyAssociatedSubnets?: Subnet[];

  @Column({ default: false })
  isMain: boolean;

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
