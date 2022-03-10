import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

// TODO: Is there a better way to deal with cross-module entities?
import { AwsSecurityGroup, } from '../../aws_security_group@0.0.1/entity';
import { cloudId, } from '../../../services/cloud-id'

// TODO complete instance schema
@Entity()
export class Instance {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true
  })
  @cloudId
  instanceId?: string;

  @Column()
  ami: string;

  @Column({
    unique: true,
  })
  name: string;

  @Column()
  instanceType: string;

  @ManyToMany(() => AwsSecurityGroup, { eager: true, })
  @JoinTable({
    name: 'instance_security_groups',
  })
  securityGroups: AwsSecurityGroup[]
}