import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { RouteTable } from './route_table';
import { Subnet } from './subnet';

@Unique('uq_routetable_routetable_subnet_ismain', ['routeTable', 'subnet', 'isMain'])
@Entity()
export class RouteTableAssociation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @cloudId
  routeTableAssociationId?: string;

  @ManyToOne(() => RouteTable, {
    nullable: false,
    eager: true,
  })
  @JoinColumn()
  routeTable: RouteTable;

  @ManyToOne(() => Subnet, {
    nullable: true,
    eager: true,
  })
  @JoinColumn()
  subnet?: Subnet;

  @Column({ default: false })
  isMain: boolean;

  // TODO: add the check so that if isMain = true, then the subnet should not be set

  // @Column()
  // associationState: string;
}
