import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, } from 'typeorm';

import { DiskInfo, } from './disk_info';

export enum EphemeralNVMESupport {
  REQUIRED = 'required',
  SUPPORTED = 'supported',
  UNSUPPORTED = 'unsupported',
}

@Entity()
export class InstanceStorageInfo {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    type: 'decimal',
  })
  totalSizeInGB: number;

  @ManyToMany(() => DiskInfo, { cascade: true })
  @JoinTable()
  disks: DiskInfo[];

  @Column({
    type: 'enum',
    enum: EphemeralNVMESupport,
  })
  NVMESupport: EphemeralNVMESupport;
}
