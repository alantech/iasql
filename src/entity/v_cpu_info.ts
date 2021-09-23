import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { ValidCore, } from './valid_core';
import { ValidThreadsPerCore, } from './valid_threads_per_core';

@Entity()
export class VCPUInfo {
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

  @ManyToMany(() => ValidCore)
  @JoinTable()
  validCores: ValidCore[];

  @ManyToMany(() => ValidThreadsPerCore)
  @JoinTable()
  validThreadsPerCore: ValidThreadsPerCore[];
}
