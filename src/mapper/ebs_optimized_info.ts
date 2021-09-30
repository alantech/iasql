import { EbsOptimizedInfo as EbsOptimizedInfoAWS } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { EBSOptimizedInfo } from '../entity/ebs_optimized_info';
import { AWS } from '../services/gateways/aws';

export const EBSOptimizedInfoMapper = new EntityMapper(EBSOptimizedInfo, {
  baselineBandwidthInMbps: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.BaselineBandwidthInMbps ?? null,
  baselineThroughputInMBps: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.BaselineThroughputInMBps ?? null,
  baselineIOPS: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.BaselineIops ?? null,
  maximumBandwidthInMbps: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.MaximumBandwidthInMbps ?? null,
  maximumThroughputInMBps: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.MaximumThroughputInMBps ?? null,
  maximumIOPS: (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.MaximumIops ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
