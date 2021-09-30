import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { EBSBlockDeviceType, } from './ebs_block_device_type';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class EBSBlockDeviceMapping {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  deviceName?: string;

  @Column({
    nullable: true,
  })
  virtualName?: string;

  @ManyToOne(() => EBSBlockDeviceType, {
    cascade: true,
    eager: true,
  })
  @JoinColumn({
    name: 'ebs_block_device_type_id',
  })
  ebs: EBSBlockDeviceType;

  @Column({
    nullable: true,
  })
  noDevice?: string;
}
