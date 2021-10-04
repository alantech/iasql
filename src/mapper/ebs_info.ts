import { EbsInfo as EbsInfoAWS } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { EBSInfo } from '../entity/ebs_info';
import { EBSOptimizedInfoMapper } from './ebs_optimized_info';
import { AWS } from '../services/gateways/aws';

export const EBSInfoMapper = new EntityMapper(EBSInfo, {
  ebsOptimizedSupport: (ebs: EbsInfoAWS, _indexes: IndexedAWS) => ebs?.EbsOptimizedSupport ?? null,
  encryptionSupport: (ebs: EbsInfoAWS, _indexes: IndexedAWS) => ebs?.EncryptionSupport ?? null,
  ebsOptimizedInfo: (ebs: EbsInfoAWS, indexes: IndexedAWS) =>
    ebs?.EbsOptimizedInfo ? EBSOptimizedInfoMapper.fromAWS(
      ebs?.EbsOptimizedInfo, indexes
    ) : null,
  NVMESupport: (ebs: EbsInfoAWS, _indexes: IndexedAWS) => ebs?.NvmeSupport ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
