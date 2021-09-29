import { IndexedAWS, } from '../services/indexed-aws'
import { EntityMapper, } from './entity';
import { CPUArchitectureMapper } from './cpu_architecture';
import { ProcessorInfo } from '../entity/processor_info';

export const ProcessorInfoMapper = new EntityMapper(ProcessorInfo, {
  supportedArchitectures: async (supportedArchitectures: string[], indexes: IndexedAWS) =>
    supportedArchitectures && supportedArchitectures.length ?
      await Promise.all(supportedArchitectures.map(
        cpuArch => CPUArchitectureMapper.fromAWS(cpuArch, indexes)
      )) :
      [],
  sustainedClockSpeedInGHz: async (sustainedClockSpeedInGHz: number, _indexes: IndexedAWS) => sustainedClockSpeedInGHz,
})
