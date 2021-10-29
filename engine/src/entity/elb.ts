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
  @Column({
    nullable: true,
  })
  loadBalancerArn?: string;

  @Column({
    nullable: true,
  })
  dnsName?: string;

  @Column({
    nullable: true,
  })
  canonicalHostedZoneId?: string;

  @Column({
    nullable: true,
    type: 'timestamp with time zone'
  })
  createdTime?: Date;

  @Column({
    unique: true,
  })
  loadBalancerName: string;

  @Column({
    type: 'enum',
    enum: LoadBalancerSchemeEnum,
  })
  scheme: LoadBalancerSchemeEnum;

  @ManyToOne(() => Vpc, { eager: true, })
  @JoinColumn({ name: 'vpc_id' })
  vpc: Vpc;

  @Column({
    nullable: true,
    type: 'enum',
    enum: LoadBalancerStateEnum,
  })
  state?: LoadBalancerStateEnum;

  @Column({
    type: 'enum',
    enum: LoadBalancerTypeEnum,
  })
  elbType: LoadBalancerTypeEnum;

  @ManyToMany(() => Subnet, { eager: true, })
  @JoinTable()
  subnets?: Subnet[];

  @ManyToMany(() => AvailabilityZone, { eager: true, })
  @JoinTable()
  availabilityZones?: AvailabilityZone[];

  @ManyToMany(() => SecurityGroup, { eager: true, })
  @JoinTable()
  securityGroups?: SecurityGroup[];

  @Column({
    type: 'enum',
    enum: IpAddressType,
  })
  ipAddressType: IpAddressType;

  @Column({
    nullable: true,
  })
  customerOwnedIpv4Pool?: string;

}
