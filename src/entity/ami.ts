import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';

import { BootMode, } from './boot_mode';
import { CPUArchitecture, } from './cpu_architecture';
import { EBSBlockDeviceMapping, } from './ebs_block_device_mapping';
import { ProductCode, } from './product_code';
import { StateReason, } from './state_reason';
import { Tag, } from './tag';
import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'

export enum ImageType {
  KERNEL = 'kernel',
  MACHINE = 'machine',
  RAMDISK = 'ramdisk',
}

export enum AMIPlatform {
  WINDOWS = 'windows',
  NA = '',
}

export enum AMIImageState {
  AVAILABLE = 'available',
  DEREGISTERED = 'deregistered',
  ERROR = 'error',
  FAILED = 'failed',
  INVALID = 'invalid',
  PENDING = 'pending',
  TRANSIENT = 'transient',
}

export enum HypervisorType {
  OVM = 'ovm',
  XEN = 'xen',
}

export enum AMIDeviceType { // TODO: Is this the same as the DeviceType entity?
  EBS = 'ebs',
  INSTANCE_STORE = 'instance-store',
}

@source(Source.AWS)
@Entity()
export class AMI {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CPUArchitecture, { eager: true, })
  @JoinColumn({
    name: 'cpu_architecture_id',
  })
  cpuArchitecture: CPUArchitecture;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
  })
  creationDate?: Date;

  @awsPrimaryKey
  @Column({
    nullable: true,
  })
  imageId?: string;

  @Column({
    nullable: true,
  })
  imageLocation?: string;

  @Column({
    type: 'enum',
    enum: ImageType,
    nullable: true,
  })
  imageType?: ImageType;

  @Column({
    nullable: true,
  })
  'public'?: boolean;

  @Column({
    nullable: true,
  })
  kernelId?: string;

  @Column({
    nullable: true,
  })
  ownerId?: string;

  @Column({
    type: 'enum',
    enum: AMIPlatform,
    nullable: true,
  })
  platform?: AMIPlatform;

  @Column({
    nullable: true,
  })
  platformDetails?: string;

  @Column({
    nullable: true,
  })
  usageOperation?: string;

  @ManyToMany(() => ProductCode, { eager: true, })
  @JoinTable()
  productCodes: ProductCode[];

  @Column({
    nullable: true,
  })
  ramdiskId?: string;

  @Column({
    type: 'enum',
    enum: AMIImageState,
    nullable: true,
  })
  state?: AMIImageState;

  @ManyToMany(() => EBSBlockDeviceMapping, { eager: true, cascade: true, })
  @JoinTable()
  blockDeviceMappings: EBSBlockDeviceMapping[];

  @Column({
    nullable: true,
  })
  description?: string;

  @Column({
    nullable: true,
  })
  enaSupport?: boolean;

  @Column({
    type: 'enum',
    enum: HypervisorType,
    nullable: true,
  })
  hypervisor?: HypervisorType;

  @Column({
    nullable: true,
  })
  imageOwnerAlias?: string;

  @Column({
    nullable: true,
  })
  name?: string;

  @Column({
    nullable: true,
  })
  rootDeviceName?: string;

  @Column({
    type: 'enum',
    enum: AMIDeviceType,
    nullable: true,
  })
  rootDeviceType?: AMIDeviceType;

  @Column({
    nullable: true,
  })
  sirovNetSupport?: string;

  @ManyToOne(() => StateReason, { eager: true, })
  @JoinColumn({
    name: 'state_reason_id',
  })
  stateReason: StateReason;

  @ManyToOne(() => BootMode, { eager: true, })
  @JoinColumn({
    name: 'boot_mode_id',
  })
  bootMode: BootMode;

  @Column({
    type: 'timestamp with time zone',
    nullable: true,
  })
  deprecationTime?: Date;

  @ManyToMany(() => Tag, { eager: true, cascade: true, })
  @JoinTable()
  tags: Tag[];
}
