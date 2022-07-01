import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  AfterLoad,
  AfterInsert,
  AfterUpdate,
  Check,
} from 'typeorm'

import { cloudId, } from '../../../../services/cloud-id'
import { Instance } from '../../aws_ec2/entity';
import { AvailabilityZone } from '../../aws_vpc/entity';

export enum GeneralPurposeVolumeType {
  GP2 = "gp2",
  GP3 = "gp3",
}

export enum VolumeState {
  AVAILABLE = "available",
  CREATING = "creating",
  DELETED = "deleted",
  DELETING = "deleting",
  ERROR = "error",
  IN_USE = "in-use",
}

@Entity()
export class GeneralPurposeVolume {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, })
  @cloudId
  volumeId?: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: GeneralPurposeVolumeType,
  })
  volumeType: GeneralPurposeVolumeType;

  @Column({
    type: 'enum',
    enum: AvailabilityZone,
  })
  availabilityZone: AvailabilityZone;

  @Check('Check_size_min_max', 'size > 0 AND size < 16385')
  @Column({
    type: 'int',
    default: 8,  // AWS default when creating an instance
  })
  size: number;

  @Column({
    nullable: true,
    type: 'enum',
    enum: VolumeState,
  })
  state?: VolumeState;

  @ManyToOne(() => Instance, instance => instance.id, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({ name: 'attached_instance_id', })
  attachedInstance?: Instance;

  @Check('Check_instance_device', '(instance_device_name IS NULL AND attached_instance_id IS NULL) OR (instance_device_name IS NOT NULL AND attached_instance_id IS NOT NULL)')
  @Column({
    nullable: true,
  })
  instanceDeviceName?: string;

  @Check('Check_gp3_iops', 'iops is NOT NULL AND volume_type = "gp3" AND iops <= 16000 AND iops >= 3000')
  @Check('Check_gp2_iops', 'iops is NOT NULL AND volume_type = "gp2" AND iops > 0')
  @Column({
    nullable: true,
    type: 'int',
  })
  iops?: number;

  @Check('Check_no_gp2_throughput', 'throughput IS NULL AND volume_type = ANY("{gp2, gp3}")')
  @Check('Check_gp3_throughput', 'throughput IS NOT NULL AND volume_type = "gp3" AND throughput >= 125 AND throughput <= 1000')
  @Column({
    nullable: true,
    type: 'int',
  })
  throughput?: number;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  updateNulls() {
    const that: any = this;
    Object.keys(this).forEach(k => {
      if (that[k] === null) that[k] = undefined;
    });
  }
}
