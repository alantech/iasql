import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, } from 'typeorm';

import { FPGADeviceInfo, } from './fpga_device_info';

@Entity()
export class FPGAInfo {
  @PrimaryGeneratedColumn()
  id?: number;

  @ManyToMany(() => FPGADeviceInfo, { cascade: true })
  @JoinTable()
  fpgas: FPGADeviceInfo[];

  @Column({
    type: 'decimal',
  })
  totalFPGAMemoryInMiB: number;
}
