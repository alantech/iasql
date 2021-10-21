import { TaskDefinition as TaskDefinitionAWS } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { TaskDefinition, } from '../entity/task_definition'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { CompatibilityMapper, ContainerDefinitionMapper } from '.'

export const TaskDefinitionMapper = new EntityMapper(TaskDefinition, {
  taskDefinitionArn: (td: TaskDefinitionAWS) => td?.taskDefinitionArn ?? null,
  containerDefinitions: async (td: TaskDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (td?.containerDefinitions?.length) {
      await Promise.all(
        td.containerDefinitions.map(cd => ContainerDefinitionMapper.fromAWS(cd, awsClient, indexes))
      );
    } else {
      return [];
    }
  },
  family: (td: TaskDefinitionAWS) => td.family,
  taskRoleArn: (td: TaskDefinitionAWS) => td?.taskRoleArn ?? null,
  executionRoleArn: (td: TaskDefinitionAWS) => td?.executionRoleArn ?? null,
  networkMode: (td: TaskDefinitionAWS) => td?.networkMode ?? null,
  revision: (td: TaskDefinitionAWS) => td?.revision ?? null,
  status: (td: TaskDefinitionAWS) => td?.status ?? null,
  requiresCompatibilities: async (td: TaskDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (td?.requiresCompatibilities?.length) {
      await Promise.all(
        td.requiresCompatibilities.map(c => CompatibilityMapper.fromAWS(c, awsClient, indexes))
      );
    } else {
      return [];
    }
  },
  cpu: (td: TaskDefinitionAWS) => td?.cpu ?? null,
  memory: (td: TaskDefinitionAWS) => td?.memory ?? null,
}, {
  readAWS: async (_awsClient: AWS, _indexes: IndexedAWS) => { return },
  createAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
  deleteAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => { throw new Error('tbd') },
})
