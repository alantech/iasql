import { Entity, PrimaryGeneratedColumn, ManyToMany, JoinTable, } from 'typeorm';

import { InferenceDeviceInfo, } from './inference_device_info';
import { source, Source, } from '../services/source-of-truth'
import { noDiff, } from '../services/diff'

@source(Source.AWS)
@Entity()
export class InferenceAcceleratorInfo {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToMany(() => InferenceDeviceInfo, { cascade: true })
  @JoinTable()
  accelerators: InferenceDeviceInfo[];
}
