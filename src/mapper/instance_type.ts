import { InstanceTypeInfo } from '@aws-sdk/client-ec2';
import * as fs from 'fs'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { UsageClassMapper } from './usage_class';
import { DeviceTypeMapper } from './device_type';
import { VirtualizationTypeMapper } from './virtualization_type';
import { ProcessorInfoMapper } from './processor_info';
import { VCPUInfoMapper } from './v_cpu_info';
import { InstanceStorageInfoMapper } from './instance_storage_info';
import { EBSInfoMapper } from './ebs_info';
import { NetworkInfoMapper } from './network_info';
import { GPUInfoMapper } from './gpu_info';
import { FPGAInfoMapper } from './fpga_info';
import { AWS } from '../services/gateways/aws';
import { InstanceType, DeviceType, UsageClass, VirtualizationType, PlacementGroupStrategy, ValidCore, ValidThreadsPerCore } from '../entity';
import { BootModeMapper, PlacementGroupInfoMapper } from '.';
import { InferenceAcceleratorInfoMapper } from './inference_accelerator_info';

export const InstanceTypeMapper = new EntityMapper(InstanceType, {
  instanceType: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.InstanceType,
  currentGeneration: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.CurrentGeneration,
  freeTierEligible: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.FreeTierEligible,
  supportedUsageClasses: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.SupportedUsageClasses && instanceType?.SupportedUsageClasses.length ?
      instanceType?.SupportedUsageClasses?.map(
        usageClass => UsageClassMapper.fromAWS(usageClass, indexes)
      ) :
      [],
  supportedRootDeviceTypes: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.SupportedRootDeviceTypes && instanceType?.SupportedRootDeviceTypes.length ?
      instanceType?.SupportedRootDeviceTypes?.map(
        deviceType => DeviceTypeMapper.fromAWS(deviceType, indexes)
      ) :
      [],
  supportedVirtualizationTypes: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.SupportedVirtualizationTypes && instanceType?.SupportedVirtualizationTypes.length ?
      instanceType?.SupportedVirtualizationTypes?.map(
        virtualizationType => VirtualizationTypeMapper.fromAWS(virtualizationType, indexes)
      ) :
      [],
  bareMetal: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.BareMetal,
  hypervisor: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.Hypervisor,
  processorInfo: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.ProcessorInfo ? ProcessorInfoMapper.fromAWS(
      instanceType?.ProcessorInfo, indexes
    ) : undefined,
  vCPUInfo: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.VCpuInfo ? VCPUInfoMapper.fromAWS(
      instanceType?.VCpuInfo, indexes
    ) : undefined,
  memorySizeInMiB: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.MemoryInfo?.SizeInMiB,
  instanceStorageSupported: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.InstanceStorageSupported,
  instanceStorageInfo: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.InstanceStorageInfo ? InstanceStorageInfoMapper.fromAWS(
      instanceType?.InstanceStorageInfo, indexes
    ) : undefined,
  ebsInfo: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.EbsInfo ? EBSInfoMapper.fromAWS(
      instanceType?.EbsInfo, indexes
    ) : undefined,
  networkInfo: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.NetworkInfo ? NetworkInfoMapper.fromAWS(
      instanceType?.NetworkInfo, indexes
    ) : undefined,
  gpuInfo: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.GpuInfo ? GPUInfoMapper.fromAWS(
      instanceType?.GpuInfo, indexes
    ) : undefined,
  fpgaInfo: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.FpgaInfo ? FPGAInfoMapper.fromAWS(
      instanceType?.FpgaInfo, indexes
    ) : undefined,
  placementGroupInfo: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.PlacementGroupInfo ? PlacementGroupInfoMapper.fromAWS(
      instanceType?.PlacementGroupInfo, indexes
    ) : undefined,
  inferenceAcceleratorInfo: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.InferenceAcceleratorInfo ? InferenceAcceleratorInfoMapper.fromAWS(
      instanceType?.InferenceAcceleratorInfo, indexes
    ) : undefined,
  hibernationSupported: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.HibernationSupported,
  burstablePerformanceSupported: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.BurstablePerformanceSupported,
  dedicatedHostsSupported: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.DedicatedHostsSupported,
  autoRecoverySupported: (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.AutoRecoverySupported,
  supportedBootModes: (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.SupportedBootModes && instanceType?.SupportedBootModes.length ?
      instanceType?.SupportedBootModes?.map(
        supportedBootMode => BootModeMapper.fromAWS(supportedBootMode, indexes)
      ) :
      [],
  // regions:  (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.,
  // availabilityZones:  (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const instanceTypes = (await awsClient.getInstanceTypes())?.InstanceTypes ?? [];
    indexes.setAll(InstanceType, instanceTypes, 'InstanceType');
    const t2 = Date.now();
    console.log(`Instance types set in ${t2 - t1}ms`);
    // Set aux AMI indexes, too
    for (const instanceType of instanceTypes) {
      if (instanceType.SupportedUsageClasses && instanceType.SupportedUsageClasses.length) {
        for (const usageClass of instanceType.SupportedUsageClasses) {
          if (usageClass) {
            indexes.set(UsageClass, usageClass, usageClass)
          } else {
            throw Error('usageClasses is this possible?');
          }
        }
      }
      if (instanceType.SupportedRootDeviceTypes && instanceType.SupportedRootDeviceTypes.length) {
        for (const supportedRootDeviceType of instanceType.SupportedRootDeviceTypes) {
          if (supportedRootDeviceType) {
            indexes.set(DeviceType, supportedRootDeviceType, supportedRootDeviceType)
          } else {
            throw Error('supportedRootDeviceTypes is this possible?');
          }
        }
      }
      if (instanceType.SupportedVirtualizationTypes && instanceType.SupportedVirtualizationTypes.length) {
        for (const supportedVirtualizationType of instanceType.SupportedVirtualizationTypes) {
          if (supportedVirtualizationType) {
            indexes.set(VirtualizationType, supportedVirtualizationType, supportedVirtualizationType)
          } else {
            throw Error('supportedVirtualizationTypes is this possible?');
          }
        }
      }
      if (instanceType.PlacementGroupInfo && instanceType.PlacementGroupInfo.SupportedStrategies && instanceType.PlacementGroupInfo.SupportedStrategies.length) {
        for (const supportedStrategy of instanceType.PlacementGroupInfo.SupportedStrategies) {
          indexes.set(PlacementGroupStrategy, supportedStrategy, supportedStrategy);
        }
      }
      if (instanceType.VCpuInfo && instanceType.VCpuInfo.ValidCores && instanceType.VCpuInfo.ValidCores.length) {
        for (const validCores of instanceType.VCpuInfo.ValidCores) {
          indexes.set(ValidCore, `${validCores}`, validCores);
        }
      }
      if (instanceType.VCpuInfo && instanceType.VCpuInfo.ValidThreadsPerCore && instanceType.VCpuInfo.ValidThreadsPerCore.length) {
        for (const validCores of instanceType.VCpuInfo.ValidThreadsPerCore) {
          indexes.set(ValidThreadsPerCore, `${validCores}`, validCores);
        }
      }
    }
    const t3 = Date.now();
    console.log(`Instance type sub entities set in ${t3 - t2}ms`);
  },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
