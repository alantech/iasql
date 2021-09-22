import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { FPGADeviceInfo, } from './fpga_device_info';

@Entity()
export class FPGAInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => FPGADeviceInfo)
  @JoinTable()
  fpgas: FPGADeviceInfo[];

  @Column({
    type: 'decimal',
  })
  totalFPGAMemoryInMiB: number;
}
