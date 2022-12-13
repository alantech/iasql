import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, ManyToOne } from 'typeorm';

import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { Instance } from '../../aws_ec2/entity';

/**
 * @enum
 * Types of possible architectures for EC2 instances
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/enums/architecturetype.html
 */
export enum Architecture {
  ARM64 = 'arm64',
  I386 = 'i386',
  X86_64 = 'x86_64',
  X86_64_MAC = 'x86_64_mac',
}

/**
 * @enum
 * Types of root devices for the instance
 * Two types are supported:
 * - ebs: uses permanent block storage to store data
 * - instance-store: uses ephemeral block storage to store data
 */
export enum RootDeviceType {
  EBS = 'ebs',
  INSTANCE_STORE = 'instance-store',
}

/**
 * Table to collect detailed information for all EC2 instances. It is directly
 * associated to each instance.
 * It is a read-only table.
 *
 * @example TheButton[Show metadata from an EC2 instance]="Show metadata from an EC2 instance"
 * ```sql
 * SELECT * FROM instance_metadata WHERE instance_id = (SELECT instance_id FROM instance WHERE tags ->> 'name' = 'test');
 * ```
 *
 * @see https://github.com/iasql/iasql-engine/blob/main/test/modules/aws-ec2-integration.ts#L1096
 */
@Entity()
export class InstanceMetadata {
  /**
   * @public
   * Reference to the instance for what we are exposing the information
   * same id as the `instance` table
   */
  @Column()
  @OneToOne(() => Instance, {
    // deleting a row from the `instance` table deletes the corresponding row here
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'id',
  })
  id?: number;

  /**
   * @public
   * Internal AWS ID for the instance
   */
  @PrimaryColumn()
  @cloudId
  instanceId: string;

  /**
   * @public
   * Architecture used for the instance
   */
  @Column({
    type: 'enum',
    enum: Architecture,
  })
  architecture: Architecture;

  /**
   * @public
   * Private IPV4 address
   */
  @Column({
    type: 'cidr',
  })
  privateIpAddress: string;

  /**
   * @public
   * Public IPV4 address
   */
  @Column({
    type: 'cidr',
    nullable: true,
  })
  publicIpAddress?: string;

  /**
   * @public
   * Public DNS name
   */
  @Column({
    type: 'character varying',
    nullable: true,
  })
  publicDnsName?: string;

  /**
   * @public
   * Time when the instance was launched
   */
  @Column({
    type: 'timestamptz',
  })
  launchTime: Date;

  /**
   * @public
   * Number of CPU cores assigned to the instance
   */
  @Column({
    type: 'int',
  })
  cpuCores: number;

  /**
   * @public
   * Memory in MB assigned to the instance
   */
  @Column({
    type: 'int',
  })
  memSizeMB: number;

  /**
   * @public
   * If it is optimized for EBS
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-optimized.html
   */
  @Column({
    type: 'boolean',
  })
  ebsOptimized: boolean;

  /**
   * @public
   * Type of root device used by the instance
   */
  @Column({
    type: 'enum',
    enum: RootDeviceType,
  })
  rootDeviceType: RootDeviceType;

  /**
   * @public
   * Name assigned to the root device
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/RootDeviceStorage.html
   */
  @Column({
    nullable: true,
  })
  rootDeviceName?: string;

  /**
   * @public
   * Region for the instance
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
