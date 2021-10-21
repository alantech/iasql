import { RegisterTaskDefinitionCommandInput, Task, TaskDefinition as TaskDefinitionAWS } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { TaskDefinition, } from '../entity/task_definition'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { CompatibilityMapper, ContainerDefinitionMapper } from '.'
import { inspect } from 'util'

export const TaskDefinitionMapper = new EntityMapper(TaskDefinition, {
  taskDefinitionArn: (td: TaskDefinitionAWS) => td?.taskDefinitionArn ?? null,
  containerDefinitions: async (td: TaskDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (td?.containerDefinitions?.length) {
      return await Promise.all(
        td.containerDefinitions.map(cd => ContainerDefinitionMapper.fromAWS(cd, awsClient, indexes))
      );
    } else {
      return [];
    }
  },
  family: (td: TaskDefinitionAWS) => td.family,
  revision: (td: TaskDefinitionAWS) => td?.revision ?? null,
  familyRevision: (td: TaskDefinitionAWS) => `${td.family}:${td.revision ?? '_'}`, // It should always have a revision but adding the fallback in case we need to debug
  taskRoleArn: (td: TaskDefinitionAWS) => td?.taskRoleArn ?? null,
  executionRoleArn: (td: TaskDefinitionAWS) => td?.executionRoleArn ?? null,
  networkMode: (td: TaskDefinitionAWS) => td?.networkMode ?? null,
  status: (td: TaskDefinitionAWS) => td?.status ?? null,
  requiresCompatibilities: async (td: TaskDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (td?.requiresCompatibilities?.length) {
      return await Promise.all(
        td.requiresCompatibilities.map(c => CompatibilityMapper.fromAWS(c, awsClient, indexes))
      );
    } else {
      return [];
    }
  },
  cpu: (td: TaskDefinitionAWS) => td?.cpu ?? null,
  memory: (td: TaskDefinitionAWS) => td?.memory ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const taskDefinitions = (await awsClient.getTaskDefinitions())?.taskDefinitions ?? [];
    console.log(inspect(taskDefinitions, false, 7, true))
    indexes.setAll(TaskDefinition, taskDefinitions, 'familyRevision');
    const t2 = Date.now();
    console.log(`TaskDefinitions set in ${t2 - t1}ms`);
  },
  createAWS: async (obj: TaskDefinition, awsClient: AWS, indexes: IndexedAWS) => {
    const input: RegisterTaskDefinitionCommandInput = {
      family: obj.family,
      containerDefinitions: obj.containerDefinitions,
      requiresCompatibilities: obj.requiresCompatibilities?.map(c => c.name!) ?? [],
    };
    const result = await awsClient.createTaskDefinition(input);
    // TODO: Handle if it fails (somehow)
    if (!result?.hasOwnProperty('familyRevision')) { // Failure
      throw new Error('what should we do here?');
    }
    const newtaskDefinition = await awsClient.getTaskDefinition(result?.familyRevision ?? '');
    indexes.set(TaskDefinition, newtaskDefinition?.familyRevision ?? '', newtaskDefinition);
    const newEntity: TaskDefinition = await TaskDefinitionMapper.fromAWS(newtaskDefinition, awsClient, indexes);
    newEntity.id = obj.id;
    for (const key of Object.keys(newEntity)) {
      EntityMapper.keepId((obj as any)[key], (newEntity as any)[key]);
      (obj as any)[key] = (newEntity as any)[key];
    }
    return newEntity;
  },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => {
    // ?: create new revisions automatically on updates?
    throw new Error('Cannot update task definitions. Create a new revision');
  },
  deleteAWS: async (obj: TaskDefinition, awsClient: AWS, indexes: IndexedAWS) => {
    await awsClient.deleteTaskDefinition(obj.familyRevision);
    indexes.del(TaskDefinition, (obj as any).family);
    return obj;
  },
})
