import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, } from 'typeorm';

import { EBSOptimizedInfo, } from './ebs_optimized_info';
import { EphemeralNVMESupport, } from './instance_storage_info';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

export enum EBSOptimizedSupport {
  DEFAULT = 'default',
  SUPPORTED = 'supported',
  UNSUPPORTED = 'unsupported',
}

export enum EBSEncryptionSupport {
  SUPPORTED = 'supported',
  UNSUPPORTED = 'unsupported',
}

@source(Source.AWS)
@Entity()
export class EBSInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

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
