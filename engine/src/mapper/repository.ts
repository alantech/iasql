import {
  Repository as RepositoryAWS,
} from '@aws-sdk/client-ecr'

import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { Repository } from '../entity'

export const RepositoryMapper: EntityMapper = new EntityMapper(Repository, {
  repositoryArn: (r: RepositoryAWS) => r?.repositoryArn ?? null,
  registryId: (r: RepositoryAWS) => r?.registryId ?? null,
  repositoryUri: (r: RepositoryAWS) => r?.repositoryUri ?? null,
  repositoryName: (r: RepositoryAWS) => r.repositoryName,
  createdAt: (r: RepositoryAWS) => r?.createdAt ? new Date(r.createdAt) : null,
  imageTagMutability: (r: RepositoryAWS) => r?.imageTagMutability ?? null,
  scanOnPush: (r: RepositoryAWS) => r?.imageScanningConfiguration?.scanOnPush ?? null,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const repositories = (await awsClient.getECRRepositories())?.Repositories ?? [];
    indexes.setAll(Repository, repositories, 'repositoryName');
    const t2 = Date.now();
    console.log(`Repository set in ${t2 - t1}ms`);
  },
  createAWS: async (obj: Repository, awsClient: AWS, indexes: IndexedAWS) => {
    const result = await awsClient.createECRRepository({
      repositoryName: obj.repositoryName,
    });
    // TODO: Handle if it fails (somehow)
    if (!result?.hasOwnProperty('repositoryName')) { // Failure
      throw new Error('what should we do here?');
    }
    const newRepository = await awsClient.getECRRepository(result.repositoryName ?? '');
    indexes.set(Repository, newRepository?.repositoryName ?? '', newRepository);
    const newEntity: Repository = await RepositoryMapper.fromAWS(newRepository, awsClient, indexes);
    newEntity.id = obj.id;
    for (const key of Object.keys(newEntity)) {
      (obj as any)[key] = (newEntity as any)[key];
    }
    return newEntity;
  },
  updateAWS: async (_obj: any, _awsClient: AWS, _indexes: IndexedAWS) => {
    throw new Error('Cannot update repository.')
  },
  deleteAWS: async (obj: Repository, awsClient: AWS, indexes: IndexedAWS) => {
    await awsClient.deleteECRRepository(obj.repositoryName);
    // TODO: What does the error even look like? Docs are spotty on this
    indexes.del(Repository, (obj as any).repositoryName);
    return obj;
  },
});
