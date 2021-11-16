import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, } from 'typeorm'

import { AvailabilityZone, AwsVpc } from '.'

export enum SubnetState {
  AVAILABLE = "available",
  PENDING = "pending",
};

@Entity()
export class AwsSubnet {
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

  @ManyToOne(() => AwsVpc, { nullable: false, })
  @JoinColumn({
    name: 'vpc_id',
  })
  vpc: AwsVpc;

  @Column({
    nullable: true,
    type: 'int',
  })
  availableIpAddressCount?: number;

  @Column({
    nullable: true,
  })
  cidrBlock?: string;

  @Column()
  subnetId: string;

  @Column({
    nullable: true,
  })
  ownerId?: string;

  @Column({
    nullable: true,
  })
  subnetArn?: string;
}