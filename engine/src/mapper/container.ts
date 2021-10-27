import { ContainerDefinition as ContainerDefinitionAWS, } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { Container, } from '../entity/container'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { EnvVariableMapper, PortMappingMapper } from '.'

export const ContainerMapper = new EntityMapper(Container, {
  name: (c: ContainerDefinitionAWS) => c.name,
  image: (c: ContainerDefinitionAWS) => c.image,
  essential: (c: ContainerDefinitionAWS) => c.essential,
  cpu: (c: ContainerDefinitionAWS) => c.cpu,
  memory: (c: ContainerDefinitionAWS) => c?.memory ?? null,
  memoryReservation: (c: ContainerDefinitionAWS) => c?.memoryReservation ?? null,
  portMappings: async (c: ContainerDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (c.portMappings?.length) {
      return await Promise.all(c.portMappings.map(p => PortMappingMapper.fromAWS(p, awsClient, indexes)));
    } else {
      return [];
    }
  },
  environment: async (c: ContainerDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (c.environment?.length) {
      return await Promise.all(c.environment.map(e => EnvVariableMapper.fromAWS(e, awsClient, indexes)));
    } else {
      return [];
    }
  },
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
