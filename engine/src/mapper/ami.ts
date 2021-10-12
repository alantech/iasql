import { Image, } from '@aws-sdk/client-ec2'

import { AMI, } from '../entity/ami'
import { AWS, } from '../services/gateways/aws'
import { BootModeMapper, } from './boot_mode'
import { CPUArchitectureMapper, } from './cpu_architecture'
import { EBSBlockDeviceMappingMapper, } from './ebs_block_device_mapping'
import { EntityMapper, } from './entity'
import * as Entities from '../entity' // TODO: Is there a way to avoid this double import?
import { IndexedAWS, } from '../services/indexed-aws'
import { ProductCodeMapper, } from './product_code'
import { StateReasonMapper, } from './state_reason'
import { TagMapper, } from './tag'

export const AMIMapper = new EntityMapper(AMI, {
  cpuArchitecture: async (
    ami: Image,
    awsClient: AWS,
    indexes: IndexedAWS
  ) => ami?.Architecture ? await CPUArchitectureMapper.fromAWS(
    ami?.Architecture, awsClient, indexes
  ) : null,
  creationDate: (ami: Image) => ami?.CreationDate ? new Date(ami.CreationDate) : null,
  imageId: (ami: Image) => ami?.ImageId ?? null,
  imageLocation: (ami: Image) => ami?.ImageLocation ?? null,
  imageType: (ami: Image) => ami?.ImageType ?? null,
  public: (ami: Image) => ami?.Public ?? null,
  kernelId: (ami: Image) => ami?.KernelId ?? null,
  ownerId: (ami: Image) => ami?.OwnerId ?? null,
  platform: (ami: Image) => ami?.Platform ?? null,
  platformDetails: (ami: Image) => ami?.PlatformDetails ?? null,
  usageOperation: (ami: Image) => ami?.UsageOperation ?? null,
  productCodes: async (ami: Image, awsClient: AWS, indexes: IndexedAWS) =>
    ami?.ProductCodes?.length ?
      await Promise.all(ami?.ProductCodes?.map(pc => ProductCodeMapper.fromAWS(pc, awsClient, indexes))) :
      [],
  ramdiskId: (ami: Image) => ami?.RamdiskId ?? null,
  state: (ami: Image) => ami?.State ?? null,
  blockDeviceMappings: async (ami: Image, awsClient: AWS, indexes: IndexedAWS) =>
    ami?.BlockDeviceMappings?.length ?
      await Promise.all(ami.BlockDeviceMappings.map(bdm => EBSBlockDeviceMappingMapper.fromAWS(bdm, awsClient, indexes))) :
      [],
  description: (ami: Image) => ami?.Description ?? null,
  enaSupport: (ami: Image) => ami?.EnaSupport ?? null,
  hypervisor: (ami: Image) => ami?.Hypervisor ?? null,
  imageOwnerAlias: (ami: Image) => ami?.ImageOwnerAlias ?? null,
  name: (ami: Image) => ami?.Name ?? null,
  rootDeviceName: (ami: Image) => ami?.RootDeviceName ?? null,
  rootDeviceType: (ami: Image) => ami?.RootDeviceType ?? null,
  sirovNetSupport: (ami: Image) => ami?.SriovNetSupport ?? null,
  stateReason: async (ami: Image, awsClient: AWS, indexes: IndexedAWS) => ami?.StateReason ?
    await StateReasonMapper.fromAWS(ami?.StateReason, awsClient, indexes) :
    null,
  bootMode: async (ami: Image, awsClient: AWS, indexes: IndexedAWS) => ami?.BootMode ?
    await BootModeMapper.fromAWS(ami?.BootMode, awsClient, indexes) :
    null,
  deprecationTime: (ami: Image) => ami?.DeprecationTime ?
    ami.DeprecationTime :
    null,
  tags: async (ami: Image, awsClient: AWS, indexes: IndexedAWS) => ami?.Tags?.length ?
    await Promise.all(ami.Tags.map(tag => TagMapper.fromAWS(tag, awsClient, indexes))) :
    [],
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const amis = (await awsClient.getAMIs())?.Images ?? [];
    indexes.setAll(AMI, amis, 'ImageId');
    const t2 = Date.now();
    console.log(`AMIs set in ${t2 - t1}ms`);
    // Set aux AMI indexes, too
    for (const ami of amis) {
      if (ami.Architecture) {
        indexes.set(Entities.CPUArchitecture, ami.Architecture, ami.Architecture);
      }
      if (ami.ProductCodes && ami.ProductCodes.length) {
        for (const pc of ami.ProductCodes) {
          if (pc.ProductCodeId) {
            indexes.set(Entities.ProductCode, pc.ProductCodeId, pc);
          } else {
            throw Error('productCodes is this possible?');
          }
        }
      }
      if (ami.StateReason) {
        if (ami.StateReason.Code) {
          indexes.set(Entities.StateReason, ami.StateReason.Code, ami.StateReason);
        } else {
          throw Error('stateReason is this possible?')
        }
      }
      if (ami.BootMode) {
        indexes.set(Entities.BootMode, ami.BootMode, ami.BootMode);
      }
    }
    const t3 = Date.now();
    console.log(`AMI sub entities set in ${t3 - t2}ms`);
  },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
