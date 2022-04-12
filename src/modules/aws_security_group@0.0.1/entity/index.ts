import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'

import { cloudId, } from '../../../services/cloud-id'
import { Vpc } from '../../aws_vpc@0.0.1/entity';

@Entity()
export class SecurityGroup {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    nullable: true,
  })
  groupName?: string;

  @Column({
    nullable: true,
  })
  ownerId?: string;

  @Column({
    nullable: true,
  })
  @cloudId
  groupId?: string;

  @ManyToOne(() => Vpc, { nullable: true, eager: true, cascade: true })
  @JoinColumn({
    name: 'vpc_id'
  })
  vpc?: Vpc;

  @OneToMany(() => SecurityGroupRule, sgr => sgr.securityGroup)
  securityGroupRules: SecurityGroupRule[];
}

@Unique('UQ_rule', ['isEgress', 'ipProtocol', 'fromPort', 'toPort', 'cidrIpv4', 'securityGroup'])
@Entity()
export class SecurityGroupRule {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true,
  })
  @cloudId
  securityGroupRuleId?: string;

  @ManyToOne(() => SecurityGroup)
  @JoinColumn({
    name: 'security_group_id',
  })
  securityGroup: SecurityGroup;

  @Column({
    nullable: false,
  })
  isEgress: boolean;

  @Column({
    nullable: false,
  })
  ipProtocol: string;

  @Column({
    nullable: true,
    type: 'int',
  })
  fromPort?: number;

  @Column({
    nullable: true,
    type: 'int',
  })
  toPort?: number;

  @Column({
    nullable: true,
    type: 'cidr',
  })
  cidrIpv4?: string;

  @Column({
    nullable: true,
    type: 'cidr',
  })
  cidrIpv6?: string;

  @Column({
    nullable: true,
  })
  prefixListId?: string;

  @Column({
    nullable: true,
  })
  description?: string;
}
