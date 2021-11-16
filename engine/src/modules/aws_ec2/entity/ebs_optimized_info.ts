import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

@Entity()
export class EBSOptimizedInfo {
  @PrimaryGeneratedColumn()
  id?: number;

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
