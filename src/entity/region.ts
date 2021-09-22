import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, } from 'typeorm';

import { InstanceType, } from './instance_type';

@Entity()
export class Region {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true
  })
  name: string | null;

  @Column({
    nullable: true
  })
  endpoint: string | null;

  @Column({
    nullable: true
  })
  optInStatus: string | null;

  @ManyToMany(() => InstanceType)
  instanceTypes: InstanceType[];
}
