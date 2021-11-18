import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm'

import { AwsSecurityGroup } from '../../aws_security_group/entity'
import { AvailabilityZone, AwsSubnet, AwsVpc, } from '../../aws_account/entity'

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

@Entity()
export class AwsLoadBalancer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    unique: true,
    nullable: false,
  })
  loadBalancerName: string;

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

  @ManyToOne(() => AwsVpc)
  @JoinColumn({
    name: 'vpc_id'
  })
  vpc: AwsVpc;

  // Not in the mapper since is just needes as input for the creation and teh retrieve endpoint
  // do not return any information related to the subnets
  @ManyToMany(() => AwsSubnet)
  @JoinTable()
  subnets?: AwsSubnet[];

  @ManyToMany(() => AvailabilityZone)
  @JoinTable()
  availabilityZones?: AvailabilityZone[];

  @ManyToMany(() => AwsSecurityGroup)
  @JoinTable()
  securityGroups?: AwsSecurityGroup[];

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
