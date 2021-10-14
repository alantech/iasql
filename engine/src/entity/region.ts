import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, OneToMany, } from 'typeorm';
import { Instance } from './instance';

import { InstanceType, } from './instance_type';
import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class Region {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @Column()
  name?: string;

  @Column()
  endpoint?: string;

  @Column()
  optInStatus?: string;

  @Column()
  active?: boolean;

  @ManyToMany(() => InstanceType)
  instanceTypes: InstanceType[];

  @OneToMany(() => Instance, i => i.region)
  instances: Instance[];
}
