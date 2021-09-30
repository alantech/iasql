import { EbsOptimizedInfo as EbsOptimizedInfoAWS } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { EBSOptimizedInfo } from '../entity/ebs_optimized_info';
import { AWS } from '../services/gateways/aws';

export const EBSOptimizedInfoMapper = new EntityMapper(EBSOptimizedInfo, {
  baselineBandwidthInMbps: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.BaselineBandwidthInMbps,
  baselineThroughputInMBps: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.BaselineThroughputInMBps,
  baselineIOPS: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.BaselineIops,
  maximumBandwidthInMbps: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.MaximumBandwidthInMbps,
  maximumThroughputInMBps: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.MaximumThroughputInMBps,
  maximumIOPS: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.MaximumIops,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
