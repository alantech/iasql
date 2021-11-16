import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AMI, } from './ami'
import { InstanceType, } from './instance_type'
// TODO: Is there a better way to deal with cross-module entities?
import { AwsSecurityGroup, } from '../../aws_security_group/entity';
import { Region, } from '../../aws_account/entity/region'

// TODO complete instance schema
@Entity()
export class Instance {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    nullable: true
  })
  instanceId?: string;

  @ManyToOne(() => AMI, { eager: true, })
  @JoinColumn({
    name: 'ami_id',
  })
  ami: AMI;

  @ManyToOne(() => Region, { eager: true, })
  @JoinColumn({
    name: 'region_id',
  })
  region: Region;

  @ManyToOne(() => InstanceType, { eager: true, })
  @JoinColumn({
    name: 'instance_type_id',
  })
  instanceType: InstanceType;

  @ManyToMany(() => AwsSecurityGroup, { eager: true, })
  @JoinTable()
  securityGroups: AwsSecurityGroup[]
}
