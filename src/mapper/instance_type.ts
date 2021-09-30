
import { InstanceTypeInfo } from '@aws-sdk/client-ec2';

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
import { InstanceType, DeviceType, UsageClass, VirtualizationType } from '../entity';

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
    }
    const t3 = Date.now();
    console.log(`Instance type sub entities set in ${t3 - t2}ms`);
  },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
