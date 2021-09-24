// -- TODO finish schema
// create table instance (
//   id int generated always as identity,
//   -- TODO nullable ipAddr generated by AWS once it is created
//   instance_id varchar(30),
//   ami_id varchar(60) not null,
//   region_id int not null,
//   instance_type_id int not null,
//   constraint fk_region foreign key(region_id) references region(region_id),
//   constraint fk_instance_type foreign key(instance_type_id) references instance_type(instance_type_id)
//   -- TODO uncomment once we populate the ami table
//   -- constraint fk_ami foreign key(ami_id) references ami(ami_id),
// );

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
