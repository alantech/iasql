import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { FPGADeviceMemoryInfo, } from './fpga_device_memory_info';

@Entity()
export class FPGADeviceInfo {
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

  @ManyToOne(() => FPGADeviceMemoryInfo)
  @JoinColumn({
    name: 'fpga_device_memory_info_id',
  })
  memoryInfo: FPGADeviceMemoryInfo;
}
