import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class EBSOptimizedInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'decimal',
  })
  baselineBandwidthInMbps: number;

  @Column({
    type: 'decimal',
  })
  baselineThroughputInMBps: number;

  @Column({
    type: 'decimal',
  })
  baselineIOPS: number;

  @Column({
    type: 'decimal',
  })
  maximumBandwidthInMbps: number;

  @Column({
    type: 'decimal',
  })
  maximumThroughputInMBps: number;

  @Column({
    type: 'decimal',
  })
  maximumIOPS: number;
}
