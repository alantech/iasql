import { FpgaDeviceInfo as FpgaDeviceInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { FPGADeviceInfo, } from '../entity/fpga_device_info';
import { FPGADeviceMemoryInfoMapper } from './fpga_device_memory_info';
import { AWS } from '../services/gateways/aws';

export const FPGADeviceInfoMapper = new EntityMapper(FPGADeviceInfo, {
  name: (fpgaDeviceInfo: FpgaDeviceInfoAWS, _indexes: IndexedAWS) => fpgaDeviceInfo?.Name ?? null,
  manufacturer: (fpgaDeviceInfo: FpgaDeviceInfoAWS, _indexes: IndexedAWS) => fpgaDeviceInfo?.Manufacturer ?? null,
  count: (fpgaDeviceInfo: FpgaDeviceInfoAWS, _indexes: IndexedAWS) => fpgaDeviceInfo?.Count ?? null,
  memoryInfo: (fpgaDeviceInfo: FpgaDeviceInfoAWS, indexes: IndexedAWS) =>
    fpgaDeviceInfo?.MemoryInfo ? FPGADeviceMemoryInfoMapper.fromAWS(
      fpgaDeviceInfo?.MemoryInfo, indexes
    ) : null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
