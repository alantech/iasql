import { Entity, PrimaryGeneratedColumn, Column, OneToMany, } from 'typeorm';

import { SecurityGroupRule, } from './security_group_rule';
import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'

@source(Source.DB)
@Entity()
export class SecurityGroup {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  description?: string;

  @awsPrimaryKey
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

  @noDiff
  @OneToMany(() => SecurityGroupRule, sgr => sgr.securityGroup)
  securityGroupRules: SecurityGroupRule[];
}