import {
  Check,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { awsResolveSupport } from '../../../services/aws-resolve-support';
import { cloudId } from '../../../services/cloud-id';
import { AwsRegions } from '../../aws_account/entity';
import { IamRole } from '../../aws_iam/entity';
// TODO: Is there a better way to deal with cross-module entities?
import { SecurityGroup } from '../../aws_security_group/entity';
import { Subnet } from '../../aws_vpc/entity';
import { InstanceBlockDeviceMapping } from './instance_block_device_mapping';

/**
 * @enum
 * Different states for the EC2 instance
 * "terminated" is ommittted because that is achieved by deleting the row
 * "pending", "shutting-down", "stopping" are ommitted because they are interim states
 */
export enum State {
  RUNNING = 'running',
  STOPPED = 'stopped',
  HIBERNATE = 'hibernate',
}

/**
 * Table to manage AWS EC2 instances. Amazon Elastic Compute Cloud (Amazon EC2) provides scalable computing capacity
 * in the Amazon Web Services (AWS) Cloud. You can use Amazon EC2 to launch as many or as few virtual servers
 * as you need, configure security and networking, and manage storage.
 *
 * @see https://aws.amazon.com/ec2/features
 */
@Entity()
@Check('check_role_ec2', 'role_name IS NULL OR (role_name IS NOT NULL AND check_role_ec2(role_name))')
@Unique('instance_id_region', ['id', 'region']) // So the General Purpose Volume entity can join on both
export class Instance {
  /**
   * @private
   * Auto-incremented ID field
   */
  @PrimaryGeneratedColumn()
  id?: number;

  /**
   * @public
   * Internal AWS ID for the instance
   */
  @Column({
    nullable: true,
    comment: 'Unique identifier provided by AWS once the instance is provisioned',
  })
  @cloudId
  instanceId?: string;

  /**
   * @public
   * Unique identifier for the image to use on the vm.
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AMIs.html
   */
  @Column()
  @awsResolveSupport
  ami: string;

  /**
   * @public
   * Type of EC2 instance to spin
   * @see https://aws.amazon.com/es/ec2/instance-types/
   */
  @Column()
  instanceType: string;

  /**
   * @public
   * Name of the keypair to use to SSH into the machine
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html
   */
  @Column({
    nullable: true,
  })
  keyPairName: string;

  /**
   * @public
   * Current state of the EC2 instance
   */
  @Column({
    type: 'enum',
    enum: State,
    default: State.RUNNING,
  })
  state: State;

  /**
   * @public
   * Text blob containing the specific user data to configure the instance
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html
   */
  @Column({
    type: 'text',
    nullable: true,
  })
  userData?: string;

  /**
   * @public
   * Complex type to provide identifier tags for the instance
   * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ec2/interfaces/createvolumecommandinput.html#tagspecifications
   */
  @Column({
    type: 'json',
    nullable: true,
  })
  tags?: { [key: string]: string };

  /**
   * @public
   * Reference to the security groups configured for that instance
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html
   */
  @ManyToMany(() => SecurityGroup, { eager: true })
  @JoinTable({
    name: 'instance_security_groups',
  })
  securityGroups: SecurityGroup[];

  /**
   * @public
   * Specific role name used to spin the instance
   * @see
   */
  @ManyToOne(() => IamRole, role => role.roleName, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'role_name',
  })
  role?: IamRole;

  /**
   * @public
   * Reference to the subnets where this instance is connected
   * @see https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html
   */
  @ManyToOne(() => Subnet, subnet => subnet.id, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({
    name: 'subnet_id',
  })
  subnet?: Subnet;

  /**
   * @public
   * Specifies if the hibernation mode is enabled for the instance
   * @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Hibernate.html
   */
  @Column({
    default: false,
  })
  hibernationEnabled: boolean;

  /**
   * @public
   * Block device mappings for the instance
   */
  @OneToMany(() => InstanceBlockDeviceMapping, mappings => mappings.instance, {
    nullable: true,
  })
  @JoinColumn({ referencedColumnName: 'instance_id' })
  instanceBlockDeviceMappings?: InstanceBlockDeviceMapping[];

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
