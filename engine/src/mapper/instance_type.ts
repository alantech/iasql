import { InstanceTypeInfo } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { BootModeMapper, PlacementGroupInfoMapper, } from '.'
import { DeviceTypeMapper, } from './device_type'
import { EBSInfoMapper, } from './ebs_info'
import { EntityMapper, } from './entity'
import { FPGAInfoMapper, } from './fpga_info'
import { GPUInfoMapper, } from './gpu_info'
import { IndexedAWS, } from '../services/indexed-aws'
import { InferenceAcceleratorInfoMapper, } from './inference_accelerator_info'
import { InstanceStorageInfoMapper, } from './instance_storage_info'
import { InstanceType, DeviceType, UsageClass, VirtualizationType, PlacementGroupStrategy, ValidCore, ValidThreadsPerCore, } from '../entity'
import { InstanceTypeValue, } from '../entity/instance_type_value'
import { InstanceTypeValueMapper, } from './instance_type_value'
import { NetworkInfoMapper, } from './network_info'
import { ProcessorInfoMapper, } from './processor_info'
import { UsageClassMapper, } from './usage_class'
import { VCPUInfoMapper, } from './v_cpu_info'
import { VirtualizationTypeMapper, } from './virtualization_type'

export const InstanceTypeMapper = new EntityMapper(InstanceType, {
  instanceType: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.InstanceType ? await InstanceTypeValueMapper.fromAWS(
      instanceType?.InstanceType, awsClient, indexes
    ) : null,
  currentGeneration: (instanceType: InstanceTypeInfo) => instanceType?.CurrentGeneration ?? null,
  freeTierEligible: (instanceType: InstanceTypeInfo) => instanceType?.FreeTierEligible ?? null,
  supportedUsageClasses: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.SupportedUsageClasses?.length ?
      await Promise.all(instanceType?.SupportedUsageClasses?.map(
        usageClass => UsageClassMapper.fromAWS(usageClass, awsClient, indexes)
      )) :
      [],
  supportedRootDeviceTypes: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.SupportedRootDeviceTypes?.length ?
      await Promise.all(instanceType?.SupportedRootDeviceTypes?.map(
        deviceType => DeviceTypeMapper.fromAWS(deviceType, awsClient, indexes)
      )) :
      [],
  supportedVirtualizationTypes: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.SupportedVirtualizationTypes?.length ?
      await Promise.all(instanceType?.SupportedVirtualizationTypes?.map(
        virtualizationType => VirtualizationTypeMapper.fromAWS(virtualizationType, awsClient, indexes)
      )) :
      [],
  bareMetal: (instanceType: InstanceTypeInfo) => instanceType?.BareMetal ?? null,
  hypervisor: (instanceType: InstanceTypeInfo) => instanceType?.Hypervisor ?? null,
  processorInfo: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.ProcessorInfo ? await ProcessorInfoMapper.fromAWS(
      instanceType?.ProcessorInfo, awsClient, indexes
    ) : null,
  vCPUInfo: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.VCpuInfo ? await VCPUInfoMapper.fromAWS(
      instanceType?.VCpuInfo, awsClient, indexes
    ) : null,
  memorySizeInMiB: (instanceType: InstanceTypeInfo) => instanceType?.MemoryInfo?.SizeInMiB?.toString?.() ?? null,
  instanceStorageSupported: (instanceType: InstanceTypeInfo) => instanceType?.InstanceStorageSupported ?? null,
  instanceStorageInfo: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.InstanceStorageInfo ? await InstanceStorageInfoMapper.fromAWS(
      instanceType?.InstanceStorageInfo, awsClient, indexes
    ) : null,
  ebsInfo: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.EbsInfo ? await EBSInfoMapper.fromAWS(
      instanceType?.EbsInfo, awsClient, indexes
    ) : null,
  networkInfo: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.NetworkInfo ? await NetworkInfoMapper.fromAWS(
      instanceType?.NetworkInfo, awsClient, indexes
    ) : null,
  gpuInfo: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.GpuInfo ? await GPUInfoMapper.fromAWS(
      instanceType?.GpuInfo, awsClient, indexes
    ) : null,
  fpgaInfo: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.FpgaInfo ? await FPGAInfoMapper.fromAWS(
      instanceType?.FpgaInfo, awsClient, indexes
    ) : null,
  placementGroupInfo: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.PlacementGroupInfo ? await PlacementGroupInfoMapper.fromAWS(
      instanceType?.PlacementGroupInfo, awsClient, indexes
    ) : null,
  inferenceAcceleratorInfo: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.InferenceAcceleratorInfo ? await InferenceAcceleratorInfoMapper.fromAWS(
      instanceType?.InferenceAcceleratorInfo, awsClient, indexes
    ) : null,
  hibernationSupported: (instanceType: InstanceTypeInfo) => instanceType?.HibernationSupported ?? null,
  burstablePerformanceSupported: (instanceType: InstanceTypeInfo) => instanceType?.BurstablePerformanceSupported ?? null,
  dedicatedHostsSupported: (instanceType: InstanceTypeInfo) => instanceType?.DedicatedHostsSupported ?? null,
  autoRecoverySupported: (instanceType: InstanceTypeInfo) => instanceType?.AutoRecoverySupported ?? null,
  supportedBootModes: async (instanceType: InstanceTypeInfo, awsClient: AWS, indexes: IndexedAWS) =>
    instanceType?.SupportedBootModes?.length ?
      await Promise.all(instanceType?.SupportedBootModes?.map(
        supportedBootMode => BootModeMapper.fromAWS(supportedBootMode, awsClient, indexes)
      )) :
      [],
  // regions:  (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.,
  // availabilityZones:  (instanceType: InstanceTypeInfo, _indexes: IndexedAWS) => instanceType?.,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const instanceTypes = (await awsClient.getInstanceTypes())?.InstanceTypes ?? [];
    indexes.setAll(InstanceType, instanceTypes, 'InstanceType');
    const instanceTypeValues = Object.keys(indexes.get(InstanceType));
    instanceTypeValues.forEach(i => indexes.set(InstanceTypeValue, i, i));
    const t2 = Date.now();
    console.log(`Instance types set in ${t2 - t1}ms`);
    // Set aux AMI indexes, too
    for (const instanceType of instanceTypes) {
      if (instanceType.SupportedUsageClasses?.length) {
        for (const usageClass of instanceType.SupportedUsageClasses) {
          if (usageClass) {
            indexes.set(UsageClass, usageClass, usageClass)
          } else {
            throw new Error('usageClasses is this possible?');
          }
        }
      }
      if (instanceType.SupportedRootDeviceTypes?.length) {
        for (const supportedRootDeviceType of instanceType.SupportedRootDeviceTypes) {
          if (supportedRootDeviceType) {
            indexes.set(DeviceType, supportedRootDeviceType, supportedRootDeviceType)
          } else {
            throw new Error('supportedRootDeviceTypes is this possible?');
          }
        }
      }
      if (instanceType.SupportedVirtualizationTypes?.length) {
        for (const supportedVirtualizationType of instanceType.SupportedVirtualizationTypes) {
          if (supportedVirtualizationType) {
            indexes.set(VirtualizationType, supportedVirtualizationType, supportedVirtualizationType)
          } else {
            throw new Error('supportedVirtualizationTypes is this possible?');
          }
        }
      }
      if (instanceType.PlacementGroupInfo?.SupportedStrategies?.length) {
        for (const supportedStrategy of instanceType.PlacementGroupInfo.SupportedStrategies) {
          indexes.set(PlacementGroupStrategy, supportedStrategy, supportedStrategy);
        }
      }
      if (instanceType.VCpuInfo?.ValidCores?.length) {
        for (const validCores of instanceType.VCpuInfo.ValidCores) {
          indexes.set(ValidCore, `${validCores}`, validCores);
        }
      }
      if (instanceType.VCpuInfo?.ValidThreadsPerCore?.length) {
        for (const validCores of instanceType.VCpuInfo.ValidThreadsPerCore) {
          indexes.set(ValidThreadsPerCore, `${validCores}`, validCores);
        }
      }
    }
    const t3 = Date.now();
    console.log(`Instance type sub entities set in ${t3 - t2}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
