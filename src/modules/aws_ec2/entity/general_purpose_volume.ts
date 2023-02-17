import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { AvailabilityZone } from '../../aws_vpc/entity';
import { Instance, InstanceBlockDeviceMapping } from '../entity';

/**
 * @enum
 * Types of supported EBS general volume types. gp2 and gp3 types are supported
 * @see https://aws.amazon.com/ebs/general-purpose/
 */
export enum GeneralPurposeVolumeType {
  GP2 = 'gp2',
  GP3 = 'gp3',
}

/**
 * @enum
 * Different states for the volume
 */
export enum VolumeState {
  AVAILABLE = 'available',
  CREATING = 'creating',
  DELETED = 'deleted',
  DELETING = 'deleting',
  ERROR = 'error',
  IN_USE = 'in-use',
}

/**
 * Table to manage AWS general purpose Volume entities. Amazon Elastic Block Store (Amazon EBS) provides block
 * level storage volumes for use with EC2 instances. EBS volumes behave like raw, unformatted block devices.
 *
 * @see https://aws.amazon.com/ebs/general-purpose/
 *
 * @privateRemarks
 * TODO: Revive this, but more safely. Currently breaks `iasql install` if the account has multiple
 * detached volumes.
 * @Unique('Unique_gp_instance_device_name', ['instanceDeviceName', 'attachedInstance'])
 */
@Unique('volume_id_region', ['id', 'region']) // So the General Purpose Volume entity can join on both
@Entity()
export class GeneralPurposeVolume {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * @public
   * AWS generated ID for the volume
   */
  @Column({ nullable: true })
  @cloudId
  volumeId?: string;

  /**
   * @public
   * Type of volume
   */
  @Column({
    nullable: false,
    type: 'enum',
    enum: GeneralPurposeVolumeType,
  })
  volumeType: GeneralPurposeVolumeType;

  /**
   * @public
   * Reference to the availability zone for the volume
   */
  @ManyToOne(() => AvailabilityZone, { nullable: false, eager: true })
  @JoinColumn({
    name: 'availability_zone',
    referencedColumnName: 'name',
  })
  availabilityZone: AvailabilityZone;

  /**
   * @public
   * The size of the volume, in GiBs. You must specify either a snapshot ID or a volume size.
   */
  @Check('Check_gp_volume_size_min_max', `"size" > 0 AND "size" < 16385`)
  @Column({
    type: 'int',
    default: 8, // AWS default when creating an instance
  })
  size: number;

  /**
   * @public
   * Current state of the volume
   */
  @Column({
    nullable: true,
    type: 'enum',
    enum: VolumeState,
  })
  state?: VolumeState;

  /**
   * @public
   * The number of I/O operations per second (IOPS)
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/createvolumerequest.html#iops
   */
  @Check(
    'Check_gp_volume_iops',
    `"iops" is NULL OR ("iops" is NOT NULL AND (("volume_type" = 'gp3' AND "iops" <= 16000 AND "iops" >= 3000) OR ("volume_type" = 'gp2' AND "iops" > 0)))`,
  )
  @Column({
    nullable: true,
    type: 'int',
  })
  iops?: number;

  /**
   * @public
   * The throughput to provision for a volume, with a maximum of 1,000 MiB/s. Only valid for gp3 volumes
   */
  @Check(
    'Check_gp_volume_throughput',
    `"throughput" IS NULL OR ("throughput" IS NOT NULL AND "volume_type" = 'gp3' AND "throughput" >= 125 AND "throughput" <= 1000)`,
  )
  @Column({
    nullable: true,
    type: 'int',
  })
  throughput?: number;

  /**
   * @public
   * The snapshot from which to create the volume. You must specify either a snapshot ID or a volume size.
   */
  @Column({ nullable: true })
  snapshotId?: string;

  /**
   * @public
   * Indicates whether the EBS volume is deleted on instance termination
   */
  @Column({
    default: true,
  })
  deleteOnTermination: boolean;

  /**
   * @public
   * Complex type to provide identifier tags for the volume
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/createvolumecommandinput.html#tagspecifications
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  /**
   * @public
   * Block device mappings for the instance
   */
  @OneToMany(() => InstanceBlockDeviceMapping, mappings => mappings.volume, {
    nullable: true,
    cascade: true,
    eager: true,
  })
  @JoinColumn({ referencedColumnName: 'volume_id' })
  instanceBlockDeviceMappings?: InstanceBlockDeviceMapping[];

  /**
   * @public
   * Region for the volume
   */
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
