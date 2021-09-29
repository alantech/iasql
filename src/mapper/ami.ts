import { Image, } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { AMI, } from '../entity/ami';
import { CPUArchitectureMapper, } from './cpu_architecture';
import { ProductCodeMapper, } from './product_code';
import { TagMapper, } from './tag';
import { StateReasonMapper, } from './state_reason';
import { BootModeMapper, } from './boot_mode';
import { EBSBlockDeviceMappingMapper, } from './ebs_block_device_mapping';

export const AMIMapper = new EntityMapper(AMI, {
  cpuArchitecture: (ami: Image, indexes: IndexedAWS) => ami?.Architecture ? CPUArchitectureMapper.fromAWS(
    ami?.Architecture, indexes
  ) : undefined,
  creationDate: (ami: Image, _indexes: IndexedAWS) => ami?.CreationDate ? ami.CreationDate : undefined,
  imageId: (ami: Image, _indexes: IndexedAWS) => ami?.ImageId,
  imageLocation: (ami: Image, _indexes: IndexedAWS) => ami?.ImageLocation,
  imageType: (ami: Image, _indexes: IndexedAWS) => ami?.ImageType,
  public: (ami: Image, _indexes: IndexedAWS) => ami?.Public,
  kernelId: (ami: Image, _indexes: IndexedAWS) => ami?.KernelId,
  ownerId: (ami: Image, _indexes: IndexedAWS) => ami?.OwnerId,
  platform: (ami: Image, _indexes: IndexedAWS) => ami?.Platform,
  platformDetails: (ami: Image, _indexes: IndexedAWS) => ami?.PlatformDetails,
  usageOperation: (ami: Image, _indexes: IndexedAWS) => ami?.UsageOperation,
  productCodes: (ami: Image, indexes: IndexedAWS) =>
    ami?.ProductCodes?.length ?
      ami?.ProductCodes?.map(pc => ProductCodeMapper.fromAWS(pc, indexes)) :
      [],
  ramdiskId: (ami: Image, _indexes: IndexedAWS) => ami?.RamdiskId,
  state: (ami: Image, _indexes: IndexedAWS) => ami?.State,
  blockDeviceMappings: (ami: Image, indexes: IndexedAWS) =>
    ami?.BlockDeviceMappings?.length ?
      ami.BlockDeviceMappings.map(bdm => EBSBlockDeviceMappingMapper.fromAWS(bdm, indexes)) :
      [],
  description: (ami: Image, _indexes: IndexedAWS) => ami?.Description,
  enaSupport: (ami: Image, _indexes: IndexedAWS) => ami?.EnaSupport,
  hypervisor: (ami: Image, _indexes: IndexedAWS) => ami?.Hypervisor,
  imageOwnerAlias: (ami: Image, _indexes: IndexedAWS) => ami?.ImageOwnerAlias,
  name: (ami: Image, _indexes: IndexedAWS) => ami?.Name,
  rootDeviceName: (ami: Image, _indexes: IndexedAWS) => ami?.RootDeviceName,
  rootDeviceType: (ami: Image, _indexes: IndexedAWS) => ami?.RootDeviceType,
  sirovNetSupport: (ami: Image, _indexes: IndexedAWS) => ami?.SriovNetSupport,
  stateReason: (ami: Image, indexes: IndexedAWS) => ami?.StateReason ?
    StateReasonMapper.fromAWS(ami?.StateReason, indexes) :
    undefined,
  bootMode: (ami: Image, indexes: IndexedAWS) => ami?.BootMode ?
    BootModeMapper.fromAWS(ami?.BootMode, indexes) :
    undefined,
  deprecationTime: (ami: Image, _indexes: IndexedAWS) => ami?.DeprecationTime ?
    ami.DeprecationTime :
    undefined,
  tags: (ami: Image, indexes: IndexedAWS) => ami?.Tags?.length ?
    ami.Tags.map(tag => TagMapper.fromAWS(tag, indexes)) :
    [],
}, {
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
