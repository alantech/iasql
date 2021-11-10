import { ContainerDefinition as ContainerDefinitionAWS, } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { Container, } from '../entity/container'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { EnvVariableMapper, PortMappingMapper, RepositoryMapper } from '.'
import { Repository } from '../entity'

export const ContainerMapper = new EntityMapper(Container, {
  name: (c: ContainerDefinitionAWS) => c.name,
  dockerImage: (c: ContainerDefinitionAWS) => {
    const image = c.image?.split(':')[0];
    if (image?.includes('amazonaws.com')) {
      return null;
    }
    return image;
  },
  repository: async (c: ContainerDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    const image = c.image?.split(':')[0];
    if (!image?.includes('amazonaws.com')) {
      return null;
    }
    let repositories = indexes.get(Repository);
    if (!repositories) {
      const awsRepositories = await awsClient.getECRRepositories();
      indexes.setAll(Repository, awsRepositories.Repositories, 'repositoryName');
      repositories = indexes.get(Repository);
    }
    const repository = Object.values(repositories).find((r: any) => r.repositoryUri === image);
    if (repository) {
      return await RepositoryMapper.fromAWS(repository, awsClient, indexes);
    }
    return null;
  },
  tag: (c: ContainerDefinitionAWS) => c.image?.split(':')[1] ?? null,
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
