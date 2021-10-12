import { FpgaDeviceInfo as FpgaDeviceInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { FPGADeviceInfo, } from '../entity/fpga_device_info'
import { FPGADeviceMemoryInfoMapper, } from './fpga_device_memory_info'
import { IndexedAWS, } from '../services/indexed-aws'

export const FPGADeviceInfoMapper = new EntityMapper(FPGADeviceInfo, {
  name: (fpgaDeviceInfo: FpgaDeviceInfoAWS) => fpgaDeviceInfo?.Name ?? null,
  manufacturer: (fpgaDeviceInfo: FpgaDeviceInfoAWS) => fpgaDeviceInfo?.Manufacturer ?? null,
  count: (fpgaDeviceInfo: FpgaDeviceInfoAWS) => fpgaDeviceInfo?.Count ?? null,
  memoryInfo: async (fpgaDeviceInfo: FpgaDeviceInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    fpgaDeviceInfo?.MemoryInfo ? await FPGADeviceMemoryInfoMapper.fromAWS(
      fpgaDeviceInfo?.MemoryInfo, awsClient, indexes
    ) : null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
