import { FpgaInfo as FpgaInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { FPGAInfo, } from '../entity/fpga_info';
import { FPGADeviceInfoMapper } from './fpga_device_info';

export const FPGAInfoMapper = new EntityMapper(FPGAInfo, {
  totalFPGAMemoryInMiB: async (fpgaInfo: FpgaInfoAWS, _indexes: IndexedAWS) => fpgaInfo?.TotalFpgaMemoryInMiB,
  fpgas: async (fpgaInfo: FpgaInfoAWS, indexes: IndexedAWS) =>
    fpgaInfo?.Fpgas && fpgaInfo?.Fpgas.length ?
      await Promise.all(fpgaInfo.Fpgas.map(
        fpga => FPGADeviceInfoMapper.fromAWS(fpga, indexes)
      )) :
      [],
})
