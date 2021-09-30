import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { FPGADeviceInfo, } from './fpga_device_info';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class FPGAInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => FPGADeviceInfo, { cascade: true })
  @JoinTable()
  fpgas: FPGADeviceInfo[];

  @Column({
    type: 'decimal',
  })
  totalFPGAMemoryInMiB: number;
}
