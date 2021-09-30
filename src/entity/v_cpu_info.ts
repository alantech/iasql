import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { ValidCore, } from './valid_core';
import { ValidThreadsPerCore, } from './valid_threads_per_core';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class VCPUInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'int',
  })
  defaultVCPUs: number;

  @Column({
    type: 'int',
  })
  defaultCores: number;

  @Column({
    type: 'int',
  })
  defaultThreadsPerCore: number;

  @ManyToMany(() => ValidCore, { cascade: true })
  @JoinTable()
  validCores: ValidCore[];

  @ManyToMany(() => ValidThreadsPerCore, { cascade: true })
  @JoinTable()
  validThreadsPerCore: ValidThreadsPerCore[];
}
