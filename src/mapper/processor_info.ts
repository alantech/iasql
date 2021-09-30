import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { CPUArchitectureMapper } from './cpu_architecture';
import { ProcessorInfo } from '../entity/processor_info';
import { AWS } from '../services/gateways/aws';

export const ProcessorInfoMapper = new EntityMapper(ProcessorInfo, {
  supportedArchitectures: (supportedArchitectures: string[], indexes: IndexedAWS) =>
    supportedArchitectures && supportedArchitectures.length ?
      supportedArchitectures.map(
        cpuArch => CPUArchitectureMapper.fromAWS(cpuArch, indexes)
      ) :
      [],
  sustainedClockSpeedInGHz: (sustainedClockSpeedInGHz: number, _indexes: IndexedAWS) => sustainedClockSpeedInGHz,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
