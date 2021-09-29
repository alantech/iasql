import { FpgaDeviceInfo as FpgaDeviceInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { FPGADeviceInfo, } from '../entity/fpga_device_info';
import { FPGADeviceMemoryInfoMapper } from './fpga_device_memory_info';

export const FPGADeviceInfoMapper = new EntityMapper(FPGADeviceInfo, {
  name: async (fpgaDeviceInfo: FpgaDeviceInfoAWS, _indexes: IndexedAWS) => fpgaDeviceInfo?.Name,
  manufacturer: async (fpgaDeviceInfo: FpgaDeviceInfoAWS, _indexes: IndexedAWS) => fpgaDeviceInfo?.Manufacturer,
  count: async (fpgaDeviceInfo: FpgaDeviceInfoAWS, _indexes: IndexedAWS) => fpgaDeviceInfo?.Count,
  memoryInfo: async (fpgaDeviceInfo: FpgaDeviceInfoAWS, indexes: IndexedAWS) =>
    fpgaDeviceInfo?.MemoryInfo ? FPGADeviceMemoryInfoMapper.fromAWS(
      fpgaDeviceInfo?.MemoryInfo, indexes
    ) : undefined,
})
