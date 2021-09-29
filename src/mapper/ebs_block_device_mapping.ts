import { BlockDeviceMapping } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EBSBlockDeviceMapping, } from '../entity/ebs_block_device_mapping';
import { EntityMapper, } from './entity';
import { EBSBlockDeviceTypeMapper } from './ebs_block_device_type';

export const EBSBlockDeviceMappingMapper = new EntityMapper(EBSBlockDeviceMapping, {
  deviceName: (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => bdm?.DeviceName,
  virtualName: (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => bdm?.VirtualName,
  ebs: (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => EBSBlockDeviceTypeMapper.fromAWS(
    bdm?.Ebs, _indexes
  ),
  noDevice: (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => bdm?.NoDevice,
}, {
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
