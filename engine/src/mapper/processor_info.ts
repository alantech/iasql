import { ProcessorInfo as ProcessorInfoAWS } from '@aws-sdk/client-ec2'

import { AWS, } from '../services/gateways/aws'
import { CPUArchitectureMapper, } from './cpu_architecture'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { ProcessorInfo, } from '../entity/processor_info'

export const ProcessorInfoMapper = new EntityMapper(ProcessorInfo, {
  supportedArchitectures: async (processorInfo: ProcessorInfoAWS, awsClient: AWS, indexes: IndexedAWS) =>
    processorInfo.SupportedArchitectures?.length ?
      await Promise.all(processorInfo.SupportedArchitectures.map(
        cpuArch => CPUArchitectureMapper.fromAWS(cpuArch, awsClient, indexes)
      )) :
      [],
  sustainedClockSpeedInGHz: (processorInfo: ProcessorInfoAWS) => processorInfo?.SustainedClockSpeedInGhz ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
