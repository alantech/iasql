import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { GPUDeviceInfo, } from './gpu_device_info';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class GPUInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => GPUDeviceInfo, { cascade: true })
  @JoinTable()
  gpus: GPUDeviceInfo[];

  @Column({
    type: 'decimal',
  })
  totalGPUMemoryInMiB: number;
}
