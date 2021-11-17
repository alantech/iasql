import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, } from 'typeorm'

@Entity({
  name: 'aws_account',
})
export class AwsAccountEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  accessKeyId: string;

  @Column()
  secretAccessKey: string;

  @Column()
  region: string;
}

export enum VpcState {
  AVAILABLE="available",
  PENDING="pending"
};

@Entity()
export class AwsVpc {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  vpcId: string;

  @Column()
  cidrBlock: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: VpcState,
  })
  state?: VpcState;

  @Column({
    default: false,
  })
  isDefault: boolean;
}

// import { AvailabilityZone, Vpc } from '.'

export enum SubnetState {
  AVAILABLE="available",
  PENDING="pending"
};

@Entity()
export class AWSSubnet {
  @PrimaryGeneratedColumn()
  id: number;

  // TODO: ADD AVAILABILITY ZONE
  // @ManyToOne(() => AvailabilityZone, { eager: true, })
  // @JoinColumn({
  //   name: 'availability_zone_id',
  // })
  // availabilityZone: AvailabilityZone;

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
