import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, } from 'typeorm';

import { DiskInfo, } from './disk_info';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

export enum EphemeralNVMESupport {
  REQUIRED = 'required',
  SUPPORTED = 'supported',
  UNSUPPORTED = 'unsupported',
}

@source(Source.AWS)
@Entity()
export class InstanceStorageInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

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
