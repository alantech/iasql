import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, } from 'typeorm';

import { GPUDeviceMemoryInfo, } from './gpu_device_memory_info';

@Entity()
export class GPUDeviceInfo {
  @PrimaryGeneratedColumn()
  id?: number;

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
