import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { AvailabilityZone } from './availability_zone';
import { RouteTableAssociation } from './route_table_association';
import { Vpc } from './vpc';

export enum SubnetState {
  AVAILABLE = 'available',
  PENDING = 'pending',
}

@Unique('uq_subnet_region', ['id', 'region'])
@Unique('uq_subnet_id_region', ['subnetId', 'region'])
@Entity()
export class Subnet {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AvailabilityZone, { nullable: false, eager: true })
  @JoinColumn([
    {
      name: 'availability_zone',
      referencedColumnName: 'name',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  availabilityZone: AvailabilityZone;

  @Column({
    nullable: true,
    type: 'enum',
    enum: SubnetState,
  })
  state?: SubnetState;

  @ManyToOne(() => Vpc, { nullable: false, eager: true })
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

  @Column({
    nullable: true,
    type: 'int',
  })
  availableIpAddressCount?: number;

  @Column({
    nullable: true,
  })
  cidrBlock?: string;

  @Column({
    nullable: true,
  })
  @cloudId
  subnetId?: string;

  @Column({
    nullable: true,
  })
  ownerId?: string;

  @Column({
    nullable: true,
  })
  subnetArn?: string;

  @OneToMany(() => RouteTableAssociation, rta => rta.routeTable, {
    nullable: true,
  })
  explicitRouteTableAssociations?: RouteTableAssociation[];

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
