import { EbsOptimizedInfo as EbsOptimizedInfoAWS } from '@aws-sdk/client-ec2';

import { AWS, } from '../services/gateways/aws'
import { EBSOptimizedInfo, } from '../entity/ebs_optimized_info'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'

export const EBSOptimizedInfoMapper = new EntityMapper(EBSOptimizedInfo, {
  baselineBandwidthInMbps: (ebs: EbsOptimizedInfoAWS) => ebs?.BaselineBandwidthInMbps ?? null,
  baselineThroughputInMBps: (ebs: EbsOptimizedInfoAWS) => ebs?.BaselineThroughputInMBps ?? null,
  baselineIOPS: (ebs: EbsOptimizedInfoAWS) => ebs?.BaselineIops ?? null,
  maximumBandwidthInMbps: (ebs: EbsOptimizedInfoAWS) => ebs?.MaximumBandwidthInMbps ?? null,
  maximumThroughputInMBps: (ebs: EbsOptimizedInfoAWS) => ebs?.MaximumThroughputInMBps ?? null,
  maximumIOPS: (ebs: EbsOptimizedInfoAWS) => ebs?.MaximumIops ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
