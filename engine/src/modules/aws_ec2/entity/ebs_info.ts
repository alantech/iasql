import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EBSOptimizedInfo, } from './ebs_optimized_info';
import { EphemeralNVMESupport, } from './instance_storage_info';

export enum EBSOptimizedSupport {
  DEFAULT = 'default',
  SUPPORTED = 'supported',
  UNSUPPORTED = 'unsupported',
}

export enum EBSEncryptionSupport {
  SUPPORTED = 'supported',
  UNSUPPORTED = 'unsupported',
}

@Entity()
export class EBSInfo {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    type: 'enum',
    enum: EBSOptimizedSupport,
  })
  ebsOptimizedSupport: EBSOptimizedSupport;

  @Column({
    type: 'enum',
    enum: EBSEncryptionSupport,
  })
  encryptionSupport: EBSEncryptionSupport;

  @ManyToOne(() => EBSOptimizedInfo, { cascade: true })
  @JoinColumn({
    name: 'ebs_optimized_info_id',
  })
  ebsOptimizedInfo: EBSOptimizedInfo;

  @Column({
    type: 'enum',
    enum: EphemeralNVMESupport,
  })
  NVMESupport: EphemeralNVMESupport;
}
