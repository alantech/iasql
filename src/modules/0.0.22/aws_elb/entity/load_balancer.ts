import { Check, Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, PrimaryColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { SecurityGroup } from '../../aws_security_group/entity';
import { Vpc } from '../../aws_vpc/entity';

export enum LoadBalancerSchemeEnum {
  INTERNAL = 'internal',
  INTERNET_FACING = 'internet-facing',
}

export enum LoadBalancerStateEnum {
  ACTIVE = 'active',
  ACTIVE_IMPAIRED = 'active_impaired',
  FAILED = 'failed',
  PROVISIONING = 'provisioning',
}

export enum LoadBalancerTypeEnum {
  APPLICATION = 'application',
  GATEWAY = 'gateway',
  NETWORK = 'network',
}

export enum IpAddressType {
  DUALSTACK = 'dualstack',
  IPV4 = 'ipv4',
}

@Entity()
@Check(
  'check_load_balancer_availability_zones',
  'check_load_balancer_availability_zones(load_balancer_name, availability_zones)',
)
@Check('check_load_balancer_subnets', 'check_load_balancer_subnets(subnets)')
export class LoadBalancer {
  @PrimaryColumn()
  loadBalancerName: string;

  @Column({
    nullable: true,
  })
  @cloudId
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
    type: 'timestamp with time zone',
  })
  createdTime?: Date;

  @Column({
    type: 'enum',
    enum: LoadBalancerSchemeEnum,
  })
  scheme: LoadBalancerSchemeEnum;

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
  loadBalancerType: LoadBalancerTypeEnum;

  @ManyToOne(() => Vpc, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'vpc',
  })
  vpc?: Vpc;

  @Column('varchar', { array: true, nullable: true })
  subnets?: string[];

  @Column('varchar', { array: true, nullable: true })
  availabilityZones?: string[];

  @ManyToMany(() => SecurityGroup, { eager: true })
  @JoinTable({
    name: 'load_balancer_security_groups',
    joinColumn: {
      name: 'load_balancer_name',
      referencedColumnName: 'loadBalancerName',
    },
  })
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
