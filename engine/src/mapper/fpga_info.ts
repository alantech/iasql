import { FpgaInfo as FpgaInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { FPGAInfo, } from '../entity'
import { FPGADeviceInfoMapper, } from './fpga_device_info'
import { IndexedAWS, } from '../services/indexed-aws'

export const FPGAInfoMapper = new EntityMapper(FPGAInfo, {
  totalFPGAMemoryInMiB: (fpgaInfo: FpgaInfoAWS) => fpgaInfo?.TotalFpgaMemoryInMiB ?? null,
  fpgas: async (fpgaInfo: FpgaInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    fpgaInfo?.Fpgas?.length ?
      await Promise.all(fpgaInfo.Fpgas.map(
        fpga => FPGADeviceInfoMapper.fromAWS(fpga, awsClient, indexes)
      )) :
      [],
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
