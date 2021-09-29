import { FpgaDeviceMemoryInfo as FpgaDeviceMemoryInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { FPGADeviceMemoryInfo, } from '../entity/fpga_device_memory_info';

export const FPGADeviceMemoryInfoMapper = new EntityMapper(FPGADeviceMemoryInfo, {
  sizeInMiB: async (fpgaDeviceMemoryInfo: FpgaDeviceMemoryInfoAWS, _indexes: IndexedAWS) => fpgaDeviceMemoryInfo?.SizeInMiB,
})
