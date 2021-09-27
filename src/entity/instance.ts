import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AMI } from './ami'
import { InstanceType } from './instance_type'
import { Region } from './region'

// TODO complete instance schema
@Entity()
export class Instance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true
  })
  instanceId?: string;

  @ManyToOne(() => AMI)
  @JoinColumn({
    name: 'ami_id',
  })
  ami: AMI;

  @ManyToOne(() => Region)
  @JoinColumn({
    name: 'region_id',
  })
  region: Region;

  @ManyToOne(() => InstanceType)
  @JoinColumn({
    name: 'instance_type_id',
  })
  instanceType: InstanceType;
}
