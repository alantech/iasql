import { EbsInfo as EbsInfoAWS } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { EBSInfo } from '../entity/ebs_info';
import { EBSOptimizedInfoMapper } from './ebs_optimized_info';

export const EBSInfoMapper = new EntityMapper(EBSInfo, {
  ebsOptimizedSupport: async (ebs: EbsInfoAWS, _indexes: IndexedAWS) => ebs?.EbsOptimizedSupport,
  encryptionSupport: async (ebs: EbsInfoAWS, _indexes: IndexedAWS) => ebs?.EncryptionSupport,
  ebsOptimizedInfo: async (ebs: EbsInfoAWS, indexes: IndexedAWS) =>
    ebs?.EbsOptimizedInfo ? EBSOptimizedInfoMapper.fromAWS(
      ebs?.EbsOptimizedInfo, indexes
    ) : undefined,
  NVMESupport: async (ebs: EbsInfoAWS, _indexes: IndexedAWS) => ebs?.NvmeSupport,
})
