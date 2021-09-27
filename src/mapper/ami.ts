import { Image, } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { AMI, } from '../entity/ami';
import { CPUArchitectureMapper, } from './cpu_architecture';
import { ProductCodeMapper, } from './product_code';
import { TagMapper, } from './tag';

export const AMIMapper = new EntityMapper(AMI, {
  cpuArchitecture: async (ami: Image, _indexes: IndexedAWS) => CPUArchitectureMapper.fromAWS(
    ami?.Architecture, _indexes
  ),
  creationDate: async (ami: Image, _indexes: IndexedAWS) => ami?.CreationDate,
  imageId: async (ami: Image, _indexes: IndexedAWS) => ami?.ImageId,
  imageLocation: async (ami: Image, _indexes: IndexedAWS) => ami?.ImageLocation,
  imageType: async (ami: Image, _indexes: IndexedAWS) => ami?.ImageType,
  public: async (ami: Image, _indexes: IndexedAWS) => ami?.Public,
  kernelId: async (ami: Image, _indexes: IndexedAWS) => ami?.KernelId,
  ownerId: async (ami: Image, _indexes: IndexedAWS) => ami?.OwnerId,
  platform: async (ami: Image, _indexes: IndexedAWS) => ami?.Platform,
  platformDetails: async (ami: Image, _indexes: IndexedAWS) => ami?.PlatformDetails,
  usageOperation: async (ami: Image, _indexes: IndexedAWS) => ami?.UsageOperation,
  productCodes: async (ami: Image, _indexes: IndexedAWS) => ami?.ProductCodes?.map(
    pc => ProductCodeMapper.fromAWS(pc, _indexes)
  ),
  ramdiskId: async (ami: Image, _indexes: IndexedAWS) => ami?.RamdiskId,
  state: async (ami: Image, _indexes: IndexedAWS) => ami?.State,
  blockDeviceMappings: async (ami: Image, _indexes: IndexedAWS) => ami?.BlockDeviceMappings, // TODO: add mapper
  description: async (ami: Image, _indexes: IndexedAWS) => ami?.Description,
  enaSupport: async (ami: Image, _indexes: IndexedAWS) => ami?.EnaSupport,
  hypervisor: async (ami: Image, _indexes: IndexedAWS) => ami?.Hypervisor,
  imageOwnerAlias: async (ami: Image, _indexes: IndexedAWS) => ami?.ImageOwnerAlias,
  name: async (ami: Image, _indexes: IndexedAWS) => ami?.Name,
  rootDeviceName: async (ami: Image, _indexes: IndexedAWS) => ami?.RootDeviceName,
  rootDeviceType: async (ami: Image, _indexes: IndexedAWS) => ami?.RootDeviceType,
  sirovNetSupport: async (ami: Image, _indexes: IndexedAWS) => ami?.SriovNetSupport,
  stateReason: async (ami: Image, _indexes: IndexedAWS) => ami?.StateReason, // TODO: add mapper
  bootMode: async (ami: Image, _indexes: IndexedAWS) => ami?.BootMode, // TODO: add mapper
  deprecationTime: async (ami: Image, _indexes: IndexedAWS) => ami?.DeprecationTime,
  tags: async (ami: Image, _indexes: IndexedAWS) => ami?.Tags?.map(
    tag => TagMapper.fromAWS(tag, _indexes)
  ),
})
