
import { InstanceTypeInfo } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { InstanceType } from '../entity/instance_type';
import { UsageClassMapper } from './usage_class';
import { DeviceTypeMapper } from './device_type';

export const InstanceTypeMapper = new EntityMapper(InstanceType, {
  instanceType: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.InstanceType,
  currentGeneration: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.CurrentGeneration,
  freeTierEligible: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.FreeTierEligible,
  supportedUsageClasses: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.SupportedUsageClasses && instanceType?.SupportedUsageClasses.length ?
      await Promise.all(instanceType?.SupportedUsageClasses?.map(
        usageClass => UsageClassMapper.fromAWS(usageClass, indexes)
      )) :
      [],
  supportedRootDeviceTypes: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.SupportedRootDeviceTypes && instanceType?.SupportedRootDeviceTypes.length ?
      await Promise.all(instanceType?.SupportedRootDeviceTypes?.map(
        deviceType => DeviceTypeMapper.fromAWS(deviceType, indexes)
      )) :
      [],
  // supportedVirtualizationTypes: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.SupportedVirtualizationTypes,
  bareMetal: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.BareMetal,
  hypervisor: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.Hypervisor,
  // processorInfo: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.ProcessorInfo,
  // vCPUInfo: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.VCpuInfo,
  memorySizeInMiB: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.MemoryInfo?.SizeInMiB,
  instanceStorageSupported: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.InstanceStorageSupported,
  // instanceStorageInfo: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.InstanceStorageInfo,
  // ebsInfo: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.EbsInfo,
  // networkInfo: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.NetworkInfo,
  // gpuInfo: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.GpuInfo,
  // fpgaInfo: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.FpgaInfo,
  // placementGroupInfo: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.PlacementGroupInfo,
  // inferenceAcceleratorInfo: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.InferenceAcceleratorInfo,
  hibernationSupported: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.HibernationSupported,
  burstablePerformanceSupported: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.BurstablePerformanceSupported,
  dedicatedHostsSupported: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.DedicatedHostsSupported,
  autoRecoverySupported: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.AutoRecoverySupported,
  // supportedBootModes: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.SupportedBootModes,
  // // regions: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.,
  // // availabilityZones: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.,
})
