import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'
import { SecurityGroup } from '.';
import { IPRange } from './ip_range';

@source(Source.DB)
@Entity()
export class DBSecurityGroup {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  dbSecurityGroupDescription?: string;

  @awsPrimaryKey
  @Column({
    nullable: true,
  })
  dbSecurityGroupName?: string;

  @Column({
    nullable: true,
  })
  ownerId?: string;

  @Column({
    nullable: true,
  })
  vpcId?: string;

  @ManyToMany(() => SecurityGroup)
  @JoinTable()
  ec2SecurityGroups: SecurityGroup[];

  @ManyToMany(() => IPRange, { cascade: true, })
  @JoinTable()
  IPRanges?: IPRange[];

  @Column({
    nullable: true,
  })
  dbSecurityGroupArn?: string;
}
