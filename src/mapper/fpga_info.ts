import { FpgaInfo as FpgaInfoAWS } from '@aws-sdk/client-ec2'

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { FPGAInfo, } from '../entity/fpga_info';
import { FPGADeviceInfoMapper } from './fpga_device_info';
import { AWS } from '../services/gateways/aws';

export const FPGAInfoMapper = new EntityMapper(FPGAInfo, {
  totalFPGAMemoryInMiB: (fpgaInfo: FpgaInfoAWS, _indexes: IndexedAWS) => fpgaInfo?.TotalFpgaMemoryInMiB ?? null,
  fpgas: (fpgaInfo: FpgaInfoAWS, indexes: IndexedAWS) =>
    fpgaInfo?.Fpgas?.length ?
      fpgaInfo.Fpgas.map(
        fpga => FPGADeviceInfoMapper.fromAWS(fpga, indexes)
      ) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
