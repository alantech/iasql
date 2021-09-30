import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { GPUDeviceMemoryInfo, } from './gpu_device_memory_info';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class GPUDeviceInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  manufacturer: string;

  @Column({
    type: 'int',
  })
  count: number;

  @ManyToOne(() => GPUDeviceMemoryInfo, { cascade: true })
  @JoinColumn({
    name: 'gpu_device_memory_info_id',
  })
  memoryInfo: GPUDeviceMemoryInfo;
}
