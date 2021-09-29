import { EbsOptimizedInfo as EbsOptimizedInfoAWS } from '@aws-sdk/client-ec2';

import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { EBSOptimizedInfo } from '../entity/ebs_optimized_info';

export const EBSOptimizedInfoMapper = new EntityMapper(EBSOptimizedInfo, {
  baselineBandwidthInMbps: async (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.BaselineBandwidthInMbps,
  baselineThroughputInMBps: async (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.BaselineThroughputInMBps,
  baselineIOPS: async (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.BaselineIops,
  maximumBandwidthInMbps: async (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.MaximumBandwidthInMbps,
  maximumThroughputInMBps: async (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.MaximumThroughputInMBps,
  maximumIOPS: async (ebs: EbsOptimizedInfoAWS, _indexes: IndexedAWS) => ebs?.MaximumIops,
})
