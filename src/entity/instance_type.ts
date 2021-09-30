import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';

import { AvailabilityZone, } from './availability_zone';
import { BootMode, } from './boot_mode';
import { DeviceType, } from './device_type';
import { EBSInfo, } from './ebs_info';
import { FPGAInfo, } from './fpga_info';
import { GPUInfo, } from './gpu_info';
import { InferenceAcceleratorInfo, } from './inference_accelerator_info';
import { InstanceStorageInfo, } from './instance_storage_info';
import { NetworkInfo, } from './network_info';
import { PlacementGroupInfo, } from './placement_group_info';
import { ProcessorInfo, } from './processor_info';
import { Region, } from './region';
import { UsageClass, } from './usage_class';
import { VCPUInfo, } from './v_cpu_info';
import { VirtualizationType, } from './virtualization_type';
import { source, Source, } from '../services/source-of-truth'
import { awsPrimaryKey, } from '../services/aws-primary-key'
import { noDiff, } from '../services/diff'

export enum InstanceTypeValue {
  R5N_12XLARGE = 'r5n.12xlarge',
  C5AD_24XLARGE = 'c5ad.24xlarge',
  X1E_8XLARGE = 'x1e.8xlarge',
  R6GD_2XLARGE = 'r6gd.2xlarge',
  X1E_2XLARGE = 'x1e.2xlarge',
  M5D_XLARGE = 'm5d.xlarge',
  F1_2XLARGE = 'f1.2xlarge',
  M2_4XLARGE = 'm2.4xlarge',
  D3EN_2XLARGE = 'd3en.2xlarge',
  R6GD_MEDIUM = 'r6gd.medium',
  M6GD_4XLARGE = 'm6gd.4xlarge',
  R6G_16XLARGE = 'r6g.16xlarge',
  M5N_16XLARGE = 'm5n.16xlarge',
  C3_8XLARGE = 'c3.8xlarge',
  M5A_16XLARGE = 'm5a.16xlarge',
  X2GD_METAL = 'x2gd.metal',
  R6G_MEDIUM = 'r6g.medium',
  C6GN_16XLARGE = 'c6gn.16xlarge',
  C3_LARGE = 'c3.large',
  M5ZN_2XLARGE = 'm5zn.2xlarge',
  M6GD_12XLARGE = 'm6gd.12xlarge',
  T1_MICRO = 't1.micro',
  R5DN_8XLARGE = 'r5dn.8xlarge',
  T4G_NANO = 't4g.nano',
  T2_2XLARGE = 't2.2xlarge',
  M5D_8XLARGE = 'm5d.8xlarge',
  M6GD_XLARGE = 'm6gd.xlarge',
  R5_24XLARGE = 'r5.24xlarge',
  M5DN_LARGE = 'm5dn.large',
  M5DN_12XLARGE = 'm5dn.12xlarge',
  G3_16XLARGE = 'g3.16xlarge',
  M5_8XLARGE = 'm5.8xlarge',
  R5A_2XLARGE = 'r5a.2xlarge',
  C6GD_METAL = 'c6gd.metal',
  C4_4XLARGE = 'c4.4xlarge',
  R6G_LARGE = 'r6g.large',
  M5A_4XLARGE = 'm5a.4xlarge',
  I3EN_24XLARGE = 'i3en.24xlarge',
  M4_4XLARGE = 'm4.4xlarge',
  R3_LARGE = 'r3.large',
  X2GD_8XLARGE = 'x2gd.8xlarge',
  R5A_XLARGE = 'r5a.xlarge',
  C5D_LARGE = 'c5d.large',
  I3EN_3XLARGE = 'i3en.3xlarge',
  M5DN_2XLARGE = 'm5dn.2xlarge',
  I2_2XLARGE = 'i2.2xlarge',
  C5N_2XLARGE = 'c5n.2xlarge',
  M5A_2XLARGE = 'm5a.2xlarge',
  M5AD_12XLARGE = 'm5ad.12xlarge',
  I3EN_12XLARGE = 'i3en.12xlarge',
  C5_4XLARGE = 'c5.4xlarge',
  C5D_12XLARGE = 'c5d.12xlarge',
  R6G_8XLARGE = 'r6g.8xlarge',
  M5AD_4XLARGE = 'm5ad.4xlarge',
  C5AD_12XLARGE = 'c5ad.12xlarge',
  R5AD_24XLARGE = 'r5ad.24xlarge',
  C6G_16XLARGE = 'c6g.16xlarge',
  Z1D_2XLARGE = 'z1d.2xlarge',
  M6GD_MEDIUM = 'm6gd.medium',
  C5N_LARGE = 'c5n.large',
  M5ZN_LARGE = 'm5zn.large',
  R4_16XLARGE = 'r4.16xlarge',
  M5ZN_6XLARGE = 'm5zn.6xlarge',
  M6I_24XLARGE = 'm6i.24xlarge',
  C4_8XLARGE = 'c4.8xlarge',
  M5_24XLARGE = 'm5.24xlarge',
  D2_8XLARGE = 'd2.8xlarge',
  C5AD_4XLARGE = 'c5ad.4xlarge',
  X1E_32XLARGE = 'x1e.32xlarge',
  R6GD_XLARGE = 'r6gd.xlarge',
  X1_16XLARGE = 'x1.16xlarge',
  T3A_2XLARGE = 't3a.2xlarge',
  M6I_LARGE = 'm6i.large',
  C6GN_XLARGE = 'c6gn.xlarge',
  D3EN_8XLARGE = 'd3en.8xlarge',
  M5DN_XLARGE = 'm5dn.xlarge',
  M5D_LARGE = 'm5d.large',
  C6G_XLARGE = 'c6g.xlarge',
  M5AD_LARGE = 'm5ad.large',
  M5D_METAL = 'm5d.metal',
  A1_MEDIUM = 'a1.medium',
  M6G_METAL = 'm6g.metal',
  G4AD_4XLARGE = 'g4ad.4xlarge',
  G4DN_METAL = 'g4dn.metal',
  INF1_XLARGE = 'inf1.xlarge',
  R5AD_8XLARGE = 'r5ad.8xlarge',
  C6GN_4XLARGE = 'c6gn.4xlarge',
  M5D_16XLARGE = 'm5d.16xlarge',
  R3_8XLARGE = 'r3.8xlarge',
  M6G_XLARGE = 'm6g.xlarge',
  R5A_12XLARGE = 'r5a.12xlarge',
  D2_2XLARGE = 'd2.2xlarge',
  R6GD_LARGE = 'r6gd.large',
  R5A_LARGE = 'r5a.large',
  M5DN_8XLARGE = 'm5dn.8xlarge',
  X2GD_4XLARGE = 'x2gd.4xlarge',
  R5AD_12XLARGE = 'r5ad.12xlarge',
  G4AD_8XLARGE = 'g4ad.8xlarge',
  T3_2XLARGE = 't3.2xlarge',
  M5_12XLARGE = 'm5.12xlarge',
  C6G_12XLARGE = 'c6g.12xlarge',
  P2_8XLARGE = 'p2.8xlarge',
  M6GD_METAL = 'm6gd.metal',
  Z1D_XLARGE = 'z1d.xlarge',
  M5_XLARGE = 'm5.xlarge',
  G4DN_12XLARGE = 'g4dn.12xlarge',
  M5AD_2XLARGE = 'm5ad.2xlarge',
  C5A_12XLARGE = 'c5a.12xlarge',
  D3_8XLARGE = 'd3.8xlarge',
  M2_2XLARGE = 'm2.2xlarge',
  C5D_2XLARGE = 'c5d.2xlarge',
  C5_XLARGE = 'c5.xlarge',
  C5A_4XLARGE = 'c5a.4xlarge',
  T4G_2XLARGE = 't4g.2xlarge',
  M5AD_8XLARGE = 'm5ad.8xlarge',
  T4G_MEDIUM = 't4g.medium',
  R5A_16XLARGE = 'r5a.16xlarge',
  M6I_8XLARGE = 'm6i.8xlarge',
  C5N_4XLARGE = 'c5n.4xlarge',
  C5AD_16XLARGE = 'c5ad.16xlarge',
  M5_METAL = 'm5.metal',
  T3_XLARGE = 't3.xlarge',
  G4AD_2XLARGE = 'g4ad.2xlarge',
  R5N_4XLARGE = 'r5n.4xlarge',
  T3A_SMALL = 't3a.small',
  M6GD_16XLARGE = 'm6gd.16xlarge',
  C4_LARGE = 'c4.large',
  M5N_8XLARGE = 'm5n.8xlarge',
  T3_LARGE = 't3.large',
  P3_2XLARGE = 'p3.2xlarge',
  C5A_XLARGE = 'c5a.xlarge',
  M5ZN_3XLARGE = 'm5zn.3xlarge',
  X2GD_MEDIUM = 'x2gd.medium',
  R6G_4XLARGE = 'r6g.4xlarge',
  C5AD_XLARGE = 'c5ad.xlarge',
  C5N_9XLARGE = 'c5n.9xlarge',
  R5_LARGE = 'r5.large',
  T2_LARGE = 't2.large',
  MAC1_METAL = 'mac1.metal',
  M4_XLARGE = 'm4.xlarge',
  X2GD_16XLARGE = 'x2gd.16xlarge',
  C1_XLARGE = 'c1.xlarge',
  R6GD_METAL = 'r6gd.metal',
  A1_XLARGE = 'a1.xlarge',
  T3_MEDIUM = 't3.medium',
  A1_LARGE = 'a1.large',
  C6GN_12XLARGE = 'c6gn.12xlarge',
  G3_8XLARGE = 'g3.8xlarge',
  G2_2XLARGE = 'g2.2xlarge',
  H1_8XLARGE = 'h1.8xlarge',
  C5A_2XLARGE = 'c5a.2xlarge',
  R5A_4XLARGE = 'r5a.4xlarge',
  R5D_4XLARGE = 'r5d.4xlarge',
  R5_METAL = 'r5.metal',
  D3_XLARGE = 'd3.xlarge',
  G3_4XLARGE = 'g3.4xlarge',
  R5N_16XLARGE = 'r5n.16xlarge',
  M4_LARGE = 'm4.large',
  C1_MEDIUM = 'c1.medium',
  C5D_24XLARGE = 'c5d.24xlarge',
  M5N_12XLARGE = 'm5n.12xlarge',
  T2_MICRO = 't2.micro',
  R3_4XLARGE = 'r3.4xlarge',
  "U-12TB1_112XLARGE" = 'u-12tb1.112xlarge',
  T3A_MEDIUM = 't3a.medium',
  VT1_3XLARGE = 'vt1.3xlarge',
  C6G_LARGE = 'c6g.large',
  R5DN_XLARGE = 'r5dn.xlarge',
  D3EN_4XLARGE = 'd3en.4xlarge',
  R6G_12XLARGE = 'r6g.12xlarge',
  C6GD_16XLARGE = 'c6gd.16xlarge',
  M6I_16XLARGE = 'm6i.16xlarge',
  R3_2XLARGE = 'r3.2xlarge',
  R5_4XLARGE = 'r5.4xlarge',
  C5_12XLARGE = 'c5.12xlarge',
  X2GD_2XLARGE = 'x2gd.2xlarge',
  H1_2XLARGE = 'h1.2xlarge',
  M1_XLARGE = 'm1.xlarge',
  M5N_LARGE = 'm5n.large',
  C6GN_MEDIUM = 'c6gn.medium',
  VT1_6XLARGE = 'vt1.6xlarge',
  M6G_4XLARGE = 'm6g.4xlarge',
  C6GD_XLARGE = 'c6gd.xlarge',
  P4D_24XLARGE = 'p4d.24xlarge',
  INF1_2XLARGE = 'inf1.2xlarge',
  C5D_4XLARGE = 'c5d.4xlarge',
  "U-6TB1_56XLARGE" = 'u-6tb1.56xlarge',
  C3_XLARGE = 'c3.xlarge',
  R5D_XLARGE = 'r5d.xlarge',
  R5AD_LARGE = 'r5ad.large',
  R5DN_METAL = 'r5dn.metal',
  R5_16XLARGE = 'r5.16xlarge',
  M3_XLARGE = 'm3.xlarge',
  D3EN_6XLARGE = 'd3en.6xlarge',
  INF1_6XLARGE = 'inf1.6xlarge',
  D3_2XLARGE = 'd3.2xlarge',
  R5DN_LARGE = 'r5dn.large',
  C5A_24XLARGE = 'c5a.24xlarge',
  R5D_LARGE = 'r5d.large',
  R6GD_4XLARGE = 'r6gd.4xlarge',
  M5_4XLARGE = 'm5.4xlarge',
  C5_24XLARGE = 'c5.24xlarge',
  M6I_4XLARGE = 'm6i.4xlarge',
  R5D_16XLARGE = 'r5d.16xlarge',
  M5ZN_12XLARGE = 'm5zn.12xlarge',
  R5D_2XLARGE = 'r5d.2xlarge',
  M5D_24XLARGE = 'm5d.24xlarge',
  M6G_8XLARGE = 'm6g.8xlarge',
  M5DN_METAL = 'm5dn.metal',
  R5N_24XLARGE = 'r5n.24xlarge',
  H1_4XLARGE = 'h1.4xlarge',
  T4G_LARGE = 't4g.large',
  M6G_LARGE = 'm6g.large',
  I2_XLARGE = 'i2.xlarge',
  C5D_18XLARGE = 'c5d.18xlarge',
  C5_METAL = 'c5.metal',
  M6I_32XLARGE = 'm6i.32xlarge',
  X2GD_XLARGE = 'x2gd.xlarge',
  R5N_2XLARGE = 'r5n.2xlarge',
  T4G_SMALL = 't4g.small',
  R4_2XLARGE = 'r4.2xlarge',
  M5N_4XLARGE = 'm5n.4xlarge',
  M4_16XLARGE = 'm4.16xlarge',
  H1_16XLARGE = 'h1.16xlarge',
  T3_NANO = 't3.nano',
  T4G_XLARGE = 't4g.xlarge',
  C5AD_2XLARGE = 'c5ad.2xlarge',
  C4_XLARGE = 'c4.xlarge',
  X2GD_12XLARGE = 'x2gd.12xlarge',
  M5ZN_METAL = 'm5zn.metal',
  R5_8XLARGE = 'r5.8xlarge',
  C4_2XLARGE = 'c4.2xlarge',
  A1_METAL = 'a1.metal',
  R3_XLARGE = 'r3.xlarge',
  R5_XLARGE = 'r5.xlarge',
  T3A_LARGE = 't3a.large',
  R5AD_2XLARGE = 'r5ad.2xlarge',
  C5N_18XLARGE = 'c5n.18xlarge',
  "U-6TB1_112XLARGE" = 'u-6tb1.112xlarge',
  M5A_8XLARGE = 'm5a.8xlarge',
  R4_XLARGE = 'r4.xlarge',
  I3_XLARGE = 'i3.xlarge',
  T4G_MICRO = 't4g.micro',
  R5D_24XLARGE = 'r5d.24xlarge',
  R5D_8XLARGE = 'r5d.8xlarge',
  A1_2XLARGE = 'a1.2xlarge',
  C5A_16XLARGE = 'c5a.16xlarge',
  M5AD_24XLARGE = 'm5ad.24xlarge',
  C5_9XLARGE = 'c5.9xlarge',
  T3_MICRO = 't3.micro',
  I2_4XLARGE = 'i2.4xlarge',
  M3_2XLARGE = 'm3.2xlarge',
  R6GD_8XLARGE = 'r6gd.8xlarge',
  R5_2XLARGE = 'r5.2xlarge',
  R5DN_16XLARGE = 'r5dn.16xlarge',
  M5_16XLARGE = 'm5.16xlarge',
  Z1D_12XLARGE = 'z1d.12xlarge',
  R5DN_12XLARGE = 'r5dn.12xlarge',
  M6G_16XLARGE = 'm6g.16xlarge',
  M5AD_XLARGE = 'm5ad.xlarge',
  I2_8XLARGE = 'i2.8xlarge',
  C3_4XLARGE = 'c3.4xlarge',
  M5D_2XLARGE = 'm5d.2xlarge',
  M6G_12XLARGE = 'm6g.12xlarge',
  I3_LARGE = 'i3.large',
  Z1D_METAL = 'z1d.metal',
  C5_LARGE = 'c5.large',
  M4_2XLARGE = 'm4.2xlarge',
  T2_MEDIUM = 't2.medium',
  G4DN_XLARGE = 'g4dn.xlarge',
  C5N_METAL = 'c5n.metal',
  R5AD_16XLARGE = 'r5ad.16xlarge',
  X2GD_LARGE = 'x2gd.large',
  X1E_16XLARGE = 'x1e.16xlarge',
  M5ZN_XLARGE = 'm5zn.xlarge',
  C3_2XLARGE = 'c3.2xlarge',
  M5DN_16XLARGE = 'm5dn.16xlarge',
  R6GD_16XLARGE = 'r6gd.16xlarge',
  M5D_12XLARGE = 'm5d.12xlarge',
  Z1D_6XLARGE = 'z1d.6xlarge',
  A1_4XLARGE = 'a1.4xlarge',
  M5_2XLARGE = 'm5.2xlarge',
  R5N_XLARGE = 'r5n.xlarge',
  M5DN_4XLARGE = 'm5dn.4xlarge',
  C6GN_LARGE = 'c6gn.large',
  M5DN_24XLARGE = 'm5dn.24xlarge',
  M6GD_8XLARGE = 'm6gd.8xlarge',
  C5D_XLARGE = 'c5d.xlarge',
  C5D_METAL = 'c5d.metal',
  Z1D_LARGE = 'z1d.large',
  M5N_XLARGE = 'm5n.xlarge',
  C5_2XLARGE = 'c5.2xlarge',
  R5D_METAL = 'r5d.metal',
  C6GN_8XLARGE = 'c6gn.8xlarge',
  M5N_24XLARGE = 'm5n.24xlarge',
  C6GN_2XLARGE = 'c6gn.2xlarge',
  M5_LARGE = 'm5.large',
  M4_10XLARGE = 'm4.10xlarge',
  I3_8XLARGE = 'i3.8xlarge',
  R5AD_XLARGE = 'r5ad.xlarge',
  I3_16XLARGE = 'i3.16xlarge',
  M5A_LARGE = 'm5a.large',
  T2_XLARGE = 't2.xlarge',
  R5AD_4XLARGE = 'r5ad.4xlarge',
  R4_LARGE = 'r4.large',
  C6G_MEDIUM = 'c6g.medium',
  R5DN_2XLARGE = 'r5dn.2xlarge',
  R6G_XLARGE = 'r6g.xlarge',
  R5N_8XLARGE = 'r5n.8xlarge',
  INF1_24XLARGE = 'inf1.24xlarge',
  VT1_24XLARGE = 'vt1.24xlarge',
  G4DN_16XLARGE = 'g4dn.16xlarge',
  C5A_8XLARGE = 'c5a.8xlarge',
  P3_16XLARGE = 'p3.16xlarge',
  G4AD_16XLARGE = 'g4ad.16xlarge',
  M5N_2XLARGE = 'm5n.2xlarge',
  X1E_XLARGE = 'x1e.xlarge',
  M6I_XLARGE = 'm6i.xlarge',
  D2_4XLARGE = 'd2.4xlarge',
  I3EN_2XLARGE = 'i3en.2xlarge',
  R4_8XLARGE = 'r4.8xlarge',
  R5A_24XLARGE = 'r5a.24xlarge',
  D3_4XLARGE = 'd3.4xlarge',
  R5_12XLARGE = 'r5.12xlarge',
  C5AD_8XLARGE = 'c5ad.8xlarge',
  X1E_4XLARGE = 'x1e.4xlarge',
  M5AD_16XLARGE = 'm5ad.16xlarge',
  I3EN_XLARGE = 'i3en.xlarge',
  X1_32XLARGE = 'x1.32xlarge',
  M3_MEDIUM = 'm3.medium',
  T3_SMALL = 't3.small',
  C6GD_4XLARGE = 'c6gd.4xlarge',
  R5A_8XLARGE = 'r5a.8xlarge',
  P2_16XLARGE = 'p2.16xlarge',
  I3_METAL = 'i3.metal',
  I3EN_LARGE = 'i3en.large',
  M6GD_2XLARGE = 'm6gd.2xlarge',
  G3S_XLARGE = 'g3s.xlarge',
  T3A_NANO = 't3a.nano',
  P2_XLARGE = 'p2.xlarge',
  R5DN_4XLARGE = 'r5dn.4xlarge',
  T2_SMALL = 't2.small',
  M3_LARGE = 'm3.large',
  C6GD_2XLARGE = 'c6gd.2xlarge',
  R6G_METAL = 'r6g.metal',
  C6G_4XLARGE = 'c6g.4xlarge',
  C5AD_LARGE = 'c5ad.large',
  R6G_2XLARGE = 'r6g.2xlarge',
  C6GD_MEDIUM = 'c6gd.medium',
  R5D_12XLARGE = 'r5d.12xlarge',
  C5A_LARGE = 'c5a.large',
  P3DN_24XLARGE = 'p3dn.24xlarge',
  M6GD_LARGE = 'm6gd.large',
  M6I_2XLARGE = 'm6i.2xlarge',
  C6GD_LARGE = 'c6gd.large',
  M6G_2XLARGE = 'm6g.2xlarge',
  C6G_2XLARGE = 'c6g.2xlarge',
  M2_XLARGE = 'm2.xlarge',
  T2_NANO = 't2.nano',
  M5D_4XLARGE = 'm5d.4xlarge',
  R4_4XLARGE = 'r4.4xlarge',
  M6G_MEDIUM = 'm6g.medium',
  F1_16XLARGE = 'f1.16xlarge',
  G4AD_XLARGE = 'g4ad.xlarge',
  F1_4XLARGE = 'f1.4xlarge',
  Z1D_3XLARGE = 'z1d.3xlarge',
  C6G_8XLARGE = 'c6g.8xlarge',
  C5N_XLARGE = 'c5n.xlarge',
  "U-9TB1_112XLARGE" = 'u-9tb1.112xlarge',
  M5A_24XLARGE = 'm5a.24xlarge',
  R6GD_12XLARGE = 'r6gd.12xlarge',
  P3_8XLARGE = 'p3.8xlarge',
  I3_2XLARGE = 'i3.2xlarge',
  M5A_XLARGE = 'm5a.xlarge',
  I3_4XLARGE = 'i3.4xlarge',
  C5_18XLARGE = 'c5.18xlarge',
  M6I_12XLARGE = 'm6i.12xlarge',
  R5DN_24XLARGE = 'r5dn.24xlarge',
  CC2_8XLARGE = 'cc2.8xlarge',
  M1_SMALL = 'm1.small',
  C6GD_12XLARGE = 'c6gd.12xlarge',
  G4DN_4XLARGE = 'g4dn.4xlarge',
  D3EN_12XLARGE = 'd3en.12xlarge',
  R5N_LARGE = 'r5n.large',
  R5N_METAL = 'r5n.metal',
  C6GD_8XLARGE = 'c6gd.8xlarge',
  D3EN_XLARGE = 'd3en.xlarge',
  C6G_METAL = 'c6g.metal',
  M1_LARGE = 'm1.large',
  G2_8XLARGE = 'g2.8xlarge',
  G4DN_2XLARGE = 'g4dn.2xlarge',
  D2_XLARGE = 'd2.xlarge',
  I3EN_METAL = 'i3en.metal',
  M1_MEDIUM = 'm1.medium',
  I3EN_6XLARGE = 'i3en.6xlarge',
  T3A_MICRO = 't3a.micro',
  C5D_9XLARGE = 'c5d.9xlarge',
  G4DN_8XLARGE = 'g4dn.8xlarge',
  M5A_12XLARGE = 'm5a.12xlarge',
  T3A_XLARGE = 't3a.xlarge'
}

export enum InstanceTypeHypervisor {
  NITRO = 'nitro',
  XEN = 'xen',
}

@source(Source.AWS)
@Entity()
export class InstanceType {
  @noDiff
  @PrimaryGeneratedColumn()
  id: number;

  @awsPrimaryKey
  @Column({
    type: 'enum',
    enum: InstanceTypeValue,
    unique: true,
  })
  instanceType: InstanceTypeValue;

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

  @ManyToMany(() => AvailabilityZone, { cascade: true, })
  @JoinTable()
  availabilityZones: AvailabilityZone[];
}
