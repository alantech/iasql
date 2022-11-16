import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { RouteTable } from './route_table';
import { Subnet } from './subnet';

@Entity()
export class RouteTableAssociation {
  @Column({ nullable: true })
  @cloudId
  routeTableAssociationId?: string;

  @ManyToOne(() => RouteTable, {
    nullable: false,
    primary: true,
  })
  @JoinColumn()
  routeTable: RouteTable;

  @ManyToOne(() => Subnet, {
    nullable: true,
    primary: true,
    eager: true,
  })
  @JoinColumn()
  subnet?: Subnet;

  @Column({ default: false })
  isMain: boolean;

  // @Column()
  // associationState: string;
}
