import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { noDiff, } from '../services/diff'
import { DBSecurityGroup, SecurityGroup } from '.';

@Entity()
export class DBSecurityGroupMembership {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DBSecurityGroup, { eager: true, cascade: true, })
  @JoinColumn({
    name: 'db_security_group_id',
  })
  dbSecurityGroup?: DBSecurityGroup;

  @Column({
    nullable: true,
  })
  status?: string;
}
