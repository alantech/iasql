import { ContainerDefinition, } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { Container, } from '../entity/container'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { EnvironmetVariableMapper, PortMappingMapper } from '.'

export const ContainerMapper = new EntityMapper(Container, {
  name: (c: ContainerDefinition) => c.name,
  image: (c: ContainerDefinition) => c.image,
  essential: (c: ContainerDefinition) => c.essential,
  portMappings: async (c: ContainerDefinition, awsClient: AWS, indexes: IndexedAWS) => {
    if (c.portMappings?.length) {
      await Promise.all(c.portMappings.map(p => PortMappingMapper.fromAWS(p, awsClient, indexes)));
    } else {
      return [];
    }
  },
  environment: async (c: ContainerDefinition, awsClient: AWS, indexes: IndexedAWS) => {
    if (c.environment?.length) {
      await Promise.all(c.environment.map(e => EnvironmetVariableMapper.fromAWS(e, awsClient, indexes)));
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
