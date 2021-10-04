import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { SecurityGroup, } from './security_group';
import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'

@source(Source.DB)
@Entity()
export class SecurityGroupRule {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @Column({
    nullable: true,
  })
  securityGroupRuleId: string;

  @Column({
    nullable: true,
  })
  groupId?: string;

  @noDiff
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
  fromPort: number;

  @Column({
    nullable: true,
    type: 'int',
  })
  toPort: number;

  @Column({
    nullable: true,
    type: 'cidr',
  })
  cidrIpv4: string;

  @Column({
    nullable: true,
    type: 'cidr',
  })
  cidrIpv6: string;

  @Column({
    nullable: true,
  })
  prefixListId: string;

  @Column({
    nullable: true,
  })
  description: string;
}
