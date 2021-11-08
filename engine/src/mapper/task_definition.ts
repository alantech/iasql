import { RegisterTaskDefinitionCommandInput, Task, TaskDefinition as TaskDefinitionAWS } from '@aws-sdk/client-ecs'

import { AWS, } from '../services/gateways/aws'
import { TaskDefinition, } from '../entity/task_definition'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { CompatibilityMapper, ContainerMapper } from '.'
import { Container } from '../entity'

export const TaskDefinitionMapper = new EntityMapper(TaskDefinition, {
  taskDefinitionArn: (td: TaskDefinitionAWS) => td?.taskDefinitionArn ?? null,
  containers: async (td: TaskDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (td?.containerDefinitions?.length) {
      return await Promise.all(
        td.containerDefinitions.map(cd => ContainerMapper.fromAWS(cd, awsClient, indexes))
      );
    } else {
      return [];
    }
  },
  container: async (td: TaskDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (td?.containerDefinitions?.length) {
      return await ContainerMapper.fromAWS(td.containerDefinitions[0], awsClient, indexes);
    }
    return null;
  },
  family: (td: TaskDefinitionAWS) => td.family,
  revision: (td: TaskDefinitionAWS) => td?.revision ?? null,
  taskRoleArn: (td: TaskDefinitionAWS) => td?.taskRoleArn ?? null,
  executionRoleArn: (td: TaskDefinitionAWS) => td?.executionRoleArn ?? null,
  networkMode: (td: TaskDefinitionAWS) => td?.networkMode ?? null,
  status: (td: TaskDefinitionAWS) => td?.status ?? null,
  reqCompatibilities: async (td: TaskDefinitionAWS, awsClient: AWS, indexes: IndexedAWS) => {
    if (td?.requiresCompatibilities?.length) {
      return await Promise.all(
        td.requiresCompatibilities.map(c => CompatibilityMapper.fromAWS(c, awsClient, indexes))
      );
    } else {
      return [];
    }
  },
  cpuMemory: (td: TaskDefinitionAWS) => td?.cpu && td?.memory ? `${+td.cpu / 1024}vCPU-${+td.memory / 1024}GB` : null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const taskDefinitions = (await awsClient.getTaskDefinitions())?.taskDefinitions ?? [];
    const t2 = Date.now();
    const containers: any = [];
    taskDefinitions.forEach(td => containers.push(...td.containerDefinitions));
    indexes.setAll(Container, containers, 'name')
    console.log(`Containers set in ${t2 - t1}ms`);
    indexes.setAll(TaskDefinition, taskDefinitions, 'taskDefinitionArn');
    const t3 = Date.now();
    console.log(`TaskDefinitions set in ${t3 - t1}ms`);
  },
  createAWS: async (obj: TaskDefinition, awsClient: AWS, indexes: IndexedAWS) => {
    const input: RegisterTaskDefinitionCommandInput = {
      family: obj.family,
      containerDefinitions: obj.containers,
      requiresCompatibilities: obj.reqCompatibilities?.map(c => c.name!) ?? [],
      networkMode: obj.networkMode,
      taskRoleArn: obj.taskRoleArn,
      executionRoleArn: obj.executionRoleArn,
    };
    if (obj.cpuMemory) {
      const [cpuStr, memoryStr] = obj.cpuMemory.split('-');
      const cpu = cpuStr.split('vCPU')[0];
      input.cpu = `${+cpu * 1024}`;
      const memory = memoryStr.split('GB')[0];
      input.memory = `${+memory * 1024}`;
    }
    const result = await awsClient.createTaskDefinition(input);
    // TODO: Handle if it fails (somehow)
    if (!result?.hasOwnProperty('taskDefinitionArn')) { // Failure
      throw new Error('what should we do here?');
    }
    const newtaskDefinition = await awsClient.getTaskDefinition(result?.taskDefinitionArn ?? '');
    indexes.set(TaskDefinition, newtaskDefinition?.taskDefinitionArn ?? '', newtaskDefinition);
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
    await awsClient.deleteTaskDefinition(obj.taskDefinitionArn!);
    indexes.del(TaskDefinition, (obj as any).taskDefinitionArn!);
    return obj;
  },
})
