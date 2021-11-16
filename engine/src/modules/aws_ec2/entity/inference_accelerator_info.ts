import { Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, } from 'typeorm';

import { InferenceDeviceInfo, } from './inference_device_info';

@Entity()
export class InferenceAcceleratorInfo {
  @PrimaryGeneratedColumn()
  id?: number;

  @ManyToMany(() => InferenceDeviceInfo, { cascade: true })
  @JoinTable()
  accelerators: InferenceDeviceInfo[];
}
