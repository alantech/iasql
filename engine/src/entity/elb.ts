import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm'

import { AvailabilityZone, SecurityGroup, Subnet, Vpc } from '.'
import { awsPrimaryKey } from '../services/aws-primary-key';
import { noDiff } from '../services/diff'
import { Source, source } from '../services/source-of-truth'

export enum LoadBalancerSchemeEnum {
  INTERNAL = "internal",
  INTERNET_FACING = "internet-facing"
}

export enum LoadBalancerStateEnum {
  ACTIVE = "active",
  ACTIVE_IMPAIRED = "active_impaired",
  FAILED = "failed",
  PROVISIONING = "provisioning"
}

export enum LoadBalancerTypeEnum {
  APPLICATION = "application",
  GATEWAY = "gateway",
  NETWORK = "network"
}

export enum IpAddressType {
  DUALSTACK = "dualstack",
  IPV4 = "ipv4"
}

@source(Source.DB)
@Entity()
export class ELB {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @noDiff
  @Column({
    nullable: true,
  })
  loadBalancerArn?: string;

  @noDiff
  @Column({
    nullable: true,
  })
  dnsName?: string;

  @noDiff
  @Column({
    nullable: true,
  })
  canonicalHostedZoneId?: string;

  @noDiff
  @Column({
    nullable: true,
    type: 'timestamp with time zone'
  })
  createdTime?: Date;

  @noDiff
  @Column({
    unique: true,
  })
  loadBalancerName: string;

  @noDiff
  @Column({
    type: 'enum',
    enum: LoadBalancerSchemeEnum,
  })
  scheme: LoadBalancerSchemeEnum;

  @noDiff
  @ManyToOne(() => Vpc, { eager: true, })
  @JoinColumn({ name: 'vpc_id' })
  vpc: Vpc;

  @noDiff
  @Column({
    nullable: true,
    type: 'enum',
    enum: LoadBalancerStateEnum,
  })
  state?: LoadBalancerStateEnum;

  @noDiff
  @Column({
    type: 'enum',
    enum: LoadBalancerTypeEnum,
  })
  elbType: LoadBalancerTypeEnum;

  // Not in the mapper since is just needes as input for the creation and teh retrieve endpoint
  // do not return any information related to the subnets
  @noDiff
  @ManyToMany(() => Subnet, { eager: true, })
  @JoinTable()
  subnets?: Subnet[];

  @noDiff
  @ManyToMany(() => AvailabilityZone, { eager: true, })
  @JoinTable()
  availabilityZones?: AvailabilityZone[];

  // TODO: work around for now to force lazy laoder fail and create the join table relations :'(
  @noDiff
  @ManyToOne(() => AvailabilityZone, { eager: true, })
  @JoinColumn({ name: 'availability_zone_id', })
  availabilityZone: AvailabilityZone;

  @noDiff
  @ManyToMany(() => SecurityGroup, { eager: true, })
  @JoinTable()
  securityGroups?: SecurityGroup[];

  @noDiff
  @Column({
    type: 'enum',
    enum: IpAddressType,
  })
  ipAddressType: IpAddressType;

  @noDiff
  @Column({
    nullable: true,
  })
  customerOwnedIpv4Pool?: string;

}
