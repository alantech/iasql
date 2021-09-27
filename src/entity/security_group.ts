import { Entity, PrimaryGeneratedColumn, Column, OneToMany, } from 'typeorm';

import { SecurityGroupRule, } from './security_group_rule';

@Entity()
export class SecurityGroup {
  @PrimaryGeneratedColumn()
  id: number;

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
  groupId?: string;

  @Column({
    nullable: true,
  })
  vpcId?: string;

  @OneToMany(() => SecurityGroupRule, sgr => sgr.securityGroup)
  securityGroupRules: SecurityGroupRule[];
}