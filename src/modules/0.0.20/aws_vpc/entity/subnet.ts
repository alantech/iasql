import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AvailabilityZone } from './availability_zone';
import { Vpc } from './vpc';

export enum SubnetState {
  AVAILABLE = 'available',
  PENDING = 'pending',
}

@Entity()
export class Subnet {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AvailabilityZone, { nullable: false, eager: true })
  @JoinColumn({
    name: 'availability_zone',
  })
  availabilityZone: AvailabilityZone;

  @Column({
    nullable: true,
    type: 'enum',
    enum: SubnetState,
  })
  state?: SubnetState;

  @ManyToOne(() => Vpc, { nullable: false, eager: true })
  @JoinColumn({
    name: 'vpc_id',
  })
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
}
