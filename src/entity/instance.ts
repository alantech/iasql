import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
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

  @OneToOne(() => AMI)
  @JoinColumn({
    name: 'ami_id',
  })
  amiId: number;

  @OneToOne(() => Region)
  @JoinColumn({
    name: 'region_id',
  })
  regionId: number;

  @OneToOne(() => InstanceType)
  @JoinColumn({
    name: 'instance_type_id',
  })
  instanceTypeId: number;
}
