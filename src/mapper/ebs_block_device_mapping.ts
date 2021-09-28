import { BlockDeviceMapping } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EBSBlockDeviceMapping, } from '../entity/ebs_block_device_mapping';
import { EntityMapper, } from './entity';
import { EBSBlockDeviceTypeMapper } from './ebs_block_device_type';

export const EBSBlockDeviceMappingMapper = new EntityMapper(EBSBlockDeviceMapping, {
  deviceName: async (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => bdm?.DeviceName,
  virtualName: async (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => bdm?.VirtualName,
  ebs: async (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => EBSBlockDeviceTypeMapper.fromAWS(
    bdm?.Ebs, _indexes
  ),
  noDevice: async (bdm: BlockDeviceMapping, _indexes: IndexedAWS) => bdm?.NoDevice,
})
