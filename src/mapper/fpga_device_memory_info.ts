import { FpgaDeviceMemoryInfo as FpgaDeviceMemoryInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { FPGADeviceMemoryInfo, } from '../entity/fpga_device_memory_info';
import { AWS } from '../services/gateways/aws';

export const FPGADeviceMemoryInfoMapper = new EntityMapper(FPGADeviceMemoryInfo, {
  sizeInMiB: (fpgaDeviceMemoryInfo: FpgaDeviceMemoryInfoAWS, _indexes: IndexedAWS) => fpgaDeviceMemoryInfo?.SizeInMiB,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
