import {Entity, PrimaryGeneratedColumn, Column, ManyToMany, } from 'typeorm';

import { InstanceType, } from './instance_type';

@Entity()
export class Region {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  endpoint: string;

  @Column()
  optInStatus: string;

  @ManyToMany(() => InstanceType)
  instanceTypes: InstanceType[];
}
