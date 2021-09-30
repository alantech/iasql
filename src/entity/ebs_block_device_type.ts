import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

export enum EBSBlockDeviceVolumeType {
  GP2 = 'gp2',
  GP3 = 'gp3',
  IO1 = 'io1',
  IO2 = 'io2',
  SC1 = 'sc1',
  ST1 = 'st1',
  STANDARD = 'standard',
}

@source(Source.AWS)
@Entity()
export class EBSBlockDeviceType {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  deleteOnTermination?: boolean;

  @Column({
    type: 'int',
    nullable: true,
  })
  iops?: number;

  @Column({
    nullable: true,
  })
  snapshotId?: string;

  @Column({
    type: 'int',
    nullable: true,
  })
  volumeSize?: number;

  @Column({
    type: 'enum',
    enum: EBSBlockDeviceVolumeType,
    nullable: true,
  })
  volumeType?: EBSBlockDeviceVolumeType;

  @Column({
    nullable: true,
  })
  kmsKeyId?: string;

  @Column({
    type: 'int',
    nullable: true,
  })
  throughput?: number;

  @Column({
    nullable: true,
  })
  outpostArn?: string;

  @Column({
    nullable: true,
  })
  encrypted?: boolean;
}
