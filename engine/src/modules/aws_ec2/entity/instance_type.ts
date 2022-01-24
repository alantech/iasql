import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AvailabilityZone, } from '../../aws_account/entity/availability_zone';
import { BootMode, } from './boot_mode';
import { DeviceType, } from './device_type';
import { EBSInfo, } from './ebs_info';
import { FPGAInfo, } from './fpga_info';
import { GPUInfo, } from './gpu_info';
import { InferenceAcceleratorInfo, } from './inference_accelerator_info';
import { Instance, } from './instance';
import { InstanceStorageInfo, } from './instance_storage_info';
import { NetworkInfo, } from './network_info';
import { PlacementGroupInfo, } from './placement_group_info';
import { ProcessorInfo, } from './processor_info';
import { Region, } from '../../aws_account/entity/region';
import { UsageClass, } from './usage_class';
import { VCPUInfo, } from './v_cpu_info';
import { VirtualizationType, } from './virtualization_type';

export enum InstanceTypeHypervisor {
  NITRO = 'nitro',
  XEN = 'xen',
}

@Entity()
export class InstanceType {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  @Column()
  currentGeneration: boolean;

  @Column()
  freeTierEligible: boolean;

  @ManyToMany(() => UsageClass, { cascade: true, })
  @JoinTable()
  supportedUsageClasses: UsageClass[];

  @ManyToMany(() => DeviceType, { cascade: true, })
  @JoinTable()
  supportedRootDeviceTypes: DeviceType[];

  @ManyToMany(() => VirtualizationType, { cascade: true, })
  @JoinTable()
  supportedVirtualizationTypes: VirtualizationType[];

  @Column()
  bareMetal: boolean;

  @Column({
    type: 'enum',
    enum: InstanceTypeHypervisor,
    nullable: true,
  })
  hypervisor?: InstanceTypeHypervisor;

  @ManyToOne(() => ProcessorInfo, { cascade: true })
  @JoinColumn({
    name: 'processor_info_id',
  })
  processorInfo: ProcessorInfo;

  @ManyToOne(() => VCPUInfo, { cascade: true })
  @JoinColumn({
    name: 'v_cpu_info_id',
  })
  vCPUInfo: VCPUInfo;

  @Column({
    type: 'decimal',
  })
  memorySizeInMiB: number;

  @Column()
  instanceStorageSupported: boolean;

  @ManyToOne(() => InstanceStorageInfo, { cascade: true })
  @JoinColumn({
    name: 'instance_storage_info_id',
  })
  instanceStorageInfo: InstanceStorageInfo;

  @ManyToOne(() => EBSInfo, { cascade: true })
  @JoinColumn({
    name: 'ebs_info_id',
  })
  ebsInfo: EBSInfo;

  @ManyToOne(() => NetworkInfo, { cascade: true })
  @JoinColumn({
    name: 'network_info_id',
  })
  networkInfo: NetworkInfo;

  @ManyToOne(() => GPUInfo, { cascade: true })
  @JoinColumn({
    name: 'gpu_info_id',
  })
  gpuInfo: GPUInfo;

  @ManyToOne(() => FPGAInfo, { cascade: true })
  @JoinColumn({
    name: 'fpga_info_id',
  })
  fpgaInfo: FPGAInfo;

  @ManyToOne(() => PlacementGroupInfo, { cascade: true })
  @JoinColumn({
    name: 'placement_group_info_id',
  })
  placementGroupInfo: PlacementGroupInfo;

  @ManyToOne(() => InferenceAcceleratorInfo, { cascade: true })
  @JoinColumn({
    name: 'inference_accelerator_info_id',
  })
  inferenceAcceleratorInfo: InferenceAcceleratorInfo;

  @Column()
  hibernationSupported: boolean;

  @Column()
  burstablePerformanceSupported: boolean;

  @Column()
  dedicatedHostsSupported: boolean;

  @Column()
  autoRecoverySupported: boolean;

  @ManyToMany(() => BootMode, { cascade: true, })
  @JoinTable()
  supportedBootModes: BootMode[];

  @ManyToMany(() => Region, { cascade: true, })
  @JoinTable()
  regions: Region[];

  @ManyToMany(() => AvailabilityZone)
  @JoinTable()
  availabilityZones: AvailabilityZone[];

  @OneToMany(() => Instance, i => i.instanceType)
  instances: Instance[];
}
