import { ContainerDefinition as ContainerDefinitionAWS, } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { ContainerDefinition, } from '../entity/container_definition'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { EnvironmetVariableMapper, PortMappingMapper } from '.'

export const ContainerDefinitionMapper = new EntityMapper(ContainerDefinition, {
  name: (c: ContainerDefinitionAWS) => c.name,
  image: (c: ContainerDefinitionAWS) => c.image,
  essential: (c: ContainerDefinitionAWS) => c.essential,
  portMappings: async (c: ContainerDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (c.portMappings?.length) {
      return await Promise.all(c.portMappings.map(p => PortMappingMapper.fromAWS(p, awsClient, indexes)));
    } else {
      return [];
    }
  },
  environment: async (c: ContainerDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (c.environment?.length) {
      return await Promise.all(c.environment.map(e => EnvironmetVariableMapper.fromAWS(e, awsClient, indexes)));
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
