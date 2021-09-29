
import { InstanceTypeInfo } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { InstanceType } from '../entity/instance_type';
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
  supportedVirtualizationTypes: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.SupportedVirtualizationTypes && instanceType?.SupportedVirtualizationTypes.length ?
      await Promise.all(instanceType?.SupportedVirtualizationTypes?.map(
        virtualizationType => VirtualizationTypeMapper.fromAWS(virtualizationType, indexes)
      )) :
      [],
  bareMetal: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.BareMetal,
  hypervisor: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.Hypervisor,
  processorInfo: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.ProcessorInfo ? ProcessorInfoMapper.fromAWS(
      instanceType?.ProcessorInfo, indexes
    ) : undefined,
  vCPUInfo: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.VCpuInfo ? VCPUInfoMapper.fromAWS(
      instanceType?.VCpuInfo, indexes
    ) : undefined,
  memorySizeInMiB: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.MemoryInfo?.SizeInMiB,
  instanceStorageSupported: async (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.InstanceStorageSupported,
  instanceStorageInfo: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.InstanceStorageInfo ? InstanceStorageInfoMapper.fromAWS(
      instanceType?.InstanceStorageInfo, indexes
    ) : undefined,
  ebsInfo: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.EbsInfo ? EBSInfoMapper.fromAWS(
      instanceType?.EbsInfo, indexes
    ) : undefined,
  networkInfo: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.NetworkInfo ? NetworkInfoMapper.fromAWS(
      instanceType?.NetworkInfo, indexes
    ) : undefined,
  gpuInfo: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.GpuInfo ? GPUInfoMapper.fromAWS(
      instanceType?.GpuInfo, indexes
    ) : undefined,
  fpgaInfo: async (instanceType: InstanceTypeInfo, indexes: IndexedAWS) =>
    instanceType?.FpgaInfo ? FPGAInfoMapper.fromAWS(
      instanceType?.FpgaInfo, indexes
    ) : undefined,
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
