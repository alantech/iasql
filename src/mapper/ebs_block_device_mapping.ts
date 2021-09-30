import { BlockDeviceMapping } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EBSBlockDeviceMapping, } from '../entity/ebs_block_device_mapping';
import { EBSBlockDeviceTypeMapper } from './ebs_block_device_type';
import { EntityMapper, } from './entity';
import { IndexedAWS, } from '../services/indexed-aws'

export const EBSBlockDeviceMappingMapper = new EntityMapper(EBSBlockDeviceMapping, {
  deviceName: (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => bdm?.DeviceName ?? null,
  virtualName: (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => bdm?.VirtualName ?? null,
  ebs: (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => EBSBlockDeviceTypeMapper.fromAWS(
    bdm?.Ebs, _indexes
  ),
  noDevice: (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => bdm?.NoDevice ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => {
    // Handled by AMI (I think?)
    return
  },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
