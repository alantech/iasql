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

  @awsPrimaryKey // TODO: What if it really is nullable?
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
