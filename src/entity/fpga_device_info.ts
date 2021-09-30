import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { FPGADeviceMemoryInfo, } from './fpga_device_memory_info';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class FPGADeviceInfo {
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

  @ManyToOne(() => FPGADeviceMemoryInfo, { cascade: true })
  @JoinColumn({
    name: 'fpga_device_memory_info_id',
  })
  memoryInfo: FPGADeviceMemoryInfo;
}
