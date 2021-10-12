import { EbsInfo as EbsInfoAWS } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EBSInfo, } from '../entity/ebs_info'
import { EBSOptimizedInfoMapper, } from './ebs_optimized_info'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const EBSInfoMapper = new EntityMapper(EBSInfo, {
  ebsOptimizedSupport: (ebs: EbsInfoAWS) => ebs?.EbsOptimizedSupport ?? null,
  encryptionSupport: (ebs: EbsInfoAWS) => ebs?.EncryptionSupport ?? null,
  ebsOptimizedInfo: async (ebs: EbsInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    ebs?.EbsOptimizedInfo ? await EBSOptimizedInfoMapper.fromAWS(
      ebs?.EbsOptimizedInfo, awsClient, indexes
    ) : null,
  NVMESupport: (ebs: EbsInfoAWS) => ebs?.NvmeSupport ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
