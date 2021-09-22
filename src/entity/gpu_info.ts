import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { GPUDeviceInfo, } from './gpu_device_info';

@Entity()
export class GPUInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => GPUDeviceInfo)
  @JoinTable()
  gpus: GPUDeviceInfo[];

  @Column({
    type: 'decimal',
  })
  totalGPUMemoryInMiB: number;
}
