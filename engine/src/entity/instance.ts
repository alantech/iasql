import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { awsPrimaryKey } from '../services/aws-primary-key';
import { noDiff } from '../services/diff';
import { Source, source } from '../services/source-of-truth';
import { AMI } from './ami'
import { InstanceType } from './instance_type'
import { Region } from './region'
import { SecurityGroup } from './security_group';

// TODO complete instance schema
@source(Source.DB)
@Entity()
export class Instance {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @Column({
    nullable: true
  })
  instanceId?: string;

  @ManyToOne(() => AMI, {eager: true,})
  @JoinColumn({
    name: 'ami_id',
  })
  ami: AMI;

  @ManyToOne(() => InstanceType, {eager: true,})
  @JoinColumn({
    name: 'instance_type_id',
  })
  instanceType: InstanceType;

  @ManyToMany(() => SecurityGroup, {eager: true,})
  @JoinTable()
  securityGroups: SecurityGroup[]
}
