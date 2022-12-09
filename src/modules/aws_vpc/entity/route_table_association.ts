import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { RouteTable } from './route_table';
import { Subnet } from './subnet';
import { Vpc } from './vpc';

@Unique('uq_routetable_routetable_subnet_ismain', ['vpc', 'subnet', 'isMain'])
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
  @JoinColumn({ name: 'route_table_id' })
  routeTable: RouteTable;

  @ManyToOne(() => Subnet, {
    nullable: true,
    eager: true,
  })
  @JoinColumn()
  subnet?: Subnet;

  @ManyToOne(() => Vpc, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  vpc: Vpc;

  @Column({ default: false })
  isMain: boolean;

  // TODO: add the check so that if isMain = true, then the subnet should not be set

  // @Column()
  // associationState: string;
}
