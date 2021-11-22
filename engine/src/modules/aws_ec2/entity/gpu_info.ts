import {  Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, } from 'typeorm';

import { GPUDeviceInfo, } from './gpu_device_info';

@Entity()
export class GPUInfo {
  @PrimaryGeneratedColumn()
  id?: number;

  @ManyToMany(() => GPUDeviceInfo, { cascade: true })
  @JoinTable()
  gpus: GPUDeviceInfo[];

  @Column({
    type: 'decimal',
  })
  totalGPUMemoryInMiB: number;
}
