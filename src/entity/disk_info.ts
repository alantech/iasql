import { Entity, PrimaryGeneratedColumn, Column, } from 'typeorm';

import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

export enum DiskType {
  HDD = 'hdd',
  SSD = 'ssd',
}

@source(Source.AWS)
@Entity()
export class DiskInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'decimal',
  })
  sizeInGB: number;

  @Column({
    type: 'int',
  })
  count: number;

  @Column({
    type: 'enum',
    enum: DiskType,
  })
  type: DiskType;
}
