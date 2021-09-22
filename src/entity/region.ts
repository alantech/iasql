import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, } from 'typeorm';

import { InstanceType, } from './instance_type';

@Entity()
export class Region {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true
  })
  name?: string;

  @Column({
    nullable: true
  })
  endpoint?: string;

  @Column({
    nullable: true
  })
  optInStatus?: string;

  @ManyToMany(() => InstanceType)
  instanceTypes: InstanceType[];
}
