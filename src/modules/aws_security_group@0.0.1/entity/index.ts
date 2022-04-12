import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'

import { cloudId, } from '../../../services/cloud-id'

@Entity()
export class SecurityGroup {
  @PrimaryColumn()
  groupName?: string;

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    nullable: true,
  })
  ownerId?: string;

  @Column({
    nullable: true,
  })
  @cloudId
  groupId?: string;

  @Column({
    nullable: true,
  })
  vpcId?: string;

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
    name: 'security_group_name',
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
