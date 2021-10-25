import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm'

import { AvailabilityZone, Vpc } from '.'
import { awsPrimaryKey } from '../services/aws-primary-key'
import { noDiff } from '../services/diff'
import { Source, source } from '../services/source-of-truth'

export enum SubnetState {
  AVAILABLE="available",
  PENDING="pending"
};

@source(Source.DB)
@Entity()
export class Subnet {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AvailabilityZone, { eager: true, })
  @JoinColumn({
    name: 'availability_zone_id',
  })
  availabilityZone: AvailabilityZone;

  @Column({
    nullable: true,
    type: 'enum',
    enum: SubnetState,
  })
  state?: SubnetState;

  @ManyToOne(() => Vpc, { eager: true, })
  @JoinColumn({
    name: 'vpc_id',
  })
  vpcId?: Vpc;

  @Column({
    nullable: true,
    type: 'int',
  })
  availableIpAddressCount?: number;

  @Column({
    nullable: true,
  })
  cidrBlock?: boolean;

  @awsPrimaryKey
  @Column({
    nullable: true,
  })
  subnetId?: string;

  @Column({
    nullable: true,
  })
  ownerId?: string;

  @Column({
    nullable: true,
  })
  subnetArn?: string;
}
