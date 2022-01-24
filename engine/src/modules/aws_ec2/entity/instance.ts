import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InstanceType, } from './instance_type'
// TODO: Is there a better way to deal with cross-module entities?
import { AwsSecurityGroup, } from '../../aws_security_group/entity';

// TODO complete instance schema
@Entity()
export class Instance {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true
  })
  instanceId?: string;

  @Column()
  ami: string;

  @ManyToOne(() => InstanceType, { eager: true, })
  @JoinColumn({
    name: 'instance_type_id',
  })
  instanceType: InstanceType;

  @ManyToMany(() => AwsSecurityGroup, { eager: true, })
  @JoinTable()
  securityGroups: AwsSecurityGroup[]
}
