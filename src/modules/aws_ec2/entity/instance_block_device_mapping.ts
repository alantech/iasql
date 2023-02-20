import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { GeneralPurposeVolume } from './general_purpose_volume';
import { Instance } from './instance';

/**
 * Table to manage AWS EC2 block device mappings. Each instance that you launch has an associated root device volume,
 * which is either an Amazon EBS volume or an instance store volume. You can use block device mapping to specify
 * additional EBS volumes or instance store volumes to attach to an instance when it's launched.
 *
 * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/block-device-mapping-concepts.html
 *
 */
@Entity()
export class InstanceBlockDeviceMapping {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Device name to associate this volume to the instance
   */
  @Column()
  deviceName: string;

  @cloudId
  @Column({ nullable: false })
  instanceId: number;

  @cloudId
  @Column({ nullable: true })
  @Index({ unique: true, where: 'volume_id IS NOT NULL' })
  volumeId?: number;

  /**
   * @public
   * The instance for this volume association
   */
  @ManyToOne(() => Instance, instance => instance.instanceBlockDeviceMappings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  instance: Instance;

  /**
   * @public
   * The volume that is associated with this specific instance
   */
  @ManyToOne(() => GeneralPurposeVolume, volume => volume.instanceBlockDeviceMappings, {
    nullable: true,
  })
  volume?: GeneralPurposeVolume;

  /**
   * @public
   * Region for the block device mapping
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
