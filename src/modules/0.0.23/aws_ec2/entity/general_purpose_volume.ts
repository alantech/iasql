import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { cloudId } from '../../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { AvailabilityZone } from '../../aws_vpc/entity';
import { Instance } from '../entity';

export enum GeneralPurposeVolumeType {
  GP2 = 'gp2',
  GP3 = 'gp3',
}

export enum VolumeState {
  AVAILABLE = 'available',
  CREATING = 'creating',
  DELETED = 'deleted',
  DELETING = 'deleting',
  ERROR = 'error',
  IN_USE = 'in-use',
}

// TODO: Revive this, but more safely. Currently breaks `iasql install` if the account has multiple
// detached volumes.
// @Unique('Unique_gp_instance_device_name', ['instanceDeviceName', 'attachedInstance'])
@Check(
  'check_instance_ebs_availability_zone',
  'check_instance_ebs_availability_zone(attached_instance_id, availability_zone)',
)
@Entity()
export class GeneralPurposeVolume {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  @cloudId
  volumeId?: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: GeneralPurposeVolumeType,
  })
  volumeType: GeneralPurposeVolumeType;

  @ManyToOne(() => AvailabilityZone, { nullable: false, eager: true })
  @JoinColumn({
    name: 'availability_zone',
    referencedColumnName: 'name',
  })
  availabilityZone: AvailabilityZone;

  @Check('Check_gp_volume_size_min_max', `"size" > 0 AND "size" < 16385`)
  @Column({
    type: 'int',
    default: 8, // AWS default when creating an instance
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
  @JoinColumn([
    {
      name: 'attached_instance_id',
      referencedColumnName: 'id',
    },
    {
      name: 'region',
      referencedColumnName: 'region',
    },
  ])
  attachedInstance?: Instance;

  @Check(
    'Check_gp_volume_instance_device',
    `("instance_device_name" IS NULL AND "attached_instance_id" IS NULL) OR ("instance_device_name" IS NOT NULL AND "attached_instance_id" IS NOT NULL)`,
  )
  @Column({
    nullable: true,
  })
  instanceDeviceName?: string;

  @Check(
    'Check_gp_volume_iops',
    `"iops" is NULL OR ("iops" is NOT NULL AND (("volume_type" = 'gp3' AND "iops" <= 16000 AND "iops" >= 3000) OR ("volume_type" = 'gp2' AND "iops" > 0)))`,
  )
  @Column({
    nullable: true,
    type: 'int',
  })
  iops?: number;

  @Check(
    'Check_gp_volume_throughput',
    `"throughput" IS NULL OR ("throughput" IS NOT NULL AND "volume_type" = 'gp3' AND "throughput" >= 125 AND "throughput" <= 1000)`,
  )
  @Column({
    nullable: true,
    type: 'int',
  })
  throughput?: number;

  @Column({ nullable: true })
  snapshotId?: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  @Column({
    type: 'character varying',
    nullable: false,
    default: () => 'default_aws_region()',
  })
  @ManyToOne(() => AwsRegions, { nullable: false })
  @JoinColumn({ name: 'region' })
  @cloudId
  region: string;
}
