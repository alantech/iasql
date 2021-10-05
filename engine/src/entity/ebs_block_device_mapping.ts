import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, } from 'typeorm';

import { EBSBlockDeviceType, } from './ebs_block_device_type';

@Entity()
export class EBSBlockDeviceMapping {
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
