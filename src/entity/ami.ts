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

export enum DeviceType {
  EBS = 'ebs',
  INSTANCE_STORE = 'instance-store',
}

@Entity()
export class AMI {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => CPUArchitecture)
  @JoinColumn({
    name: 'cpu_architecture_id',
  })
  cpuArchitecture: CPUArchitecture;

  @Column({
    type: 'timestamp with time zone',
  })
  creationDate: Date;

  @Column()
  imageId: string;

  @Column()
  imageLocation: string;

  @Column({
    type: 'enum',
    enum: ImageType,
  })
  imageType: ImageType;

  @Column()
  'public': boolean;

  @Column()
  kernelId: string;

  @Column()
  ownerId: string;

  @Column({
    type: 'enum',
    enum: AMIPlatform,
  })
  platform: AMIPlatform;

  @Column()
  platformDetails: string;

  @Column()
  usageOperation: string;

  @ManyToMany(() => ProductCode)
  @JoinTable()
  productCodes: ProductCode[];

  @Column()
  ramdiskId: string;

  @Column({
    type: 'enum',
    enum: AMIImageState,
  })
  state: AMIImageState;

  @ManyToMany(() => EBSBlockDeviceMapping)
  @JoinTable()
  blockDeviceMappings: EBSBlockDeviceMapping[];

  @Column()
  description: string;

  @Column()
  enaSupport: boolean;

  @Column({
    type: 'enum',
    enum: HypervisorType,
  })
  hypervisor: HypervisorType;

  @Column()
  imageOwnerAlias: string;

  @Column()
  name: string;

  @Column()
  rootDeviceName: string;

  @Column({
    type: 'enum',
    enum: DeviceType,
  })
  rootDeviceType: DeviceType;

  @Column()
  sirovNetSupport: string;

  @ManyToOne(() => StateReason)
  @JoinColumn({
    name: 'state_reason_id',
  })
  stateReason: StateReason;

  @ManyToOne(() => BootMode)
  @JoinColumn({
    name: 'boot_mode_id',
  })
  bootMode: BootMode;

  @Column({
    type: 'timestamp with time zone',
  })
  deprecationTime: Date;

  @ManyToMany(() => Tag)
  @JoinTable()
  tags: Tag[];
}
