import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { noDiff, } from '../services/diff'
import { SecurityGroup } from '.';

@Entity()
export class SecurityGroupMembership {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SecurityGroup)
  @JoinColumn({
    name: 'security_group_id',
  })
  securityGroup?: SecurityGroup;

  @Column({
    nullable: true,
  })
  status?: string;
}
