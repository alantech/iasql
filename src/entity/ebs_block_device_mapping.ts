import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { EBSBlockDeviceType, } from './ebs_block_device_type';

@Entity()
export class EBSBlockDeviceMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  deviceName: string;

  @Column()
  virtualName: string;

  @ManyToOne(() => EBSBlockDeviceType)
  @JoinColumn({
    name: 'ebs_block_device_type_id',
  })
  ebs: EBSBlockDeviceType;

  @Column()
  noDevice: string;
}
