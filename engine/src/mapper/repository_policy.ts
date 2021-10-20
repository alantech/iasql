import { AWS, } from '../services/gateways/aws'
import { EntityMapper, } from './entity'
import { IndexedAWS, } from '../services/indexed-aws'
import { Repository, RepositoryPolicy } from '../entity'
import { RepositoryMapper } from '.';
import { DepError } from '../services/lazy-dep';

export const RepositoryPolicyMapper: EntityMapper = new EntityMapper(RepositoryPolicy, {
  repository: async (rp: any, awsClient: AWS, indexes: IndexedAWS) => {
    const repository = await indexes.getOr(Repository, rp.repositoryName, awsClient.getECRRepository.bind(awsClient));
    return await RepositoryMapper.fromAWS(repository, awsClient, indexes);
  },
  registryId: (rp: any) => rp?.registryId ?? null,
  policyText: (rp: any) => rp?.policyText?.replaceAll('\n', '').replace(/\s+/g,' ') ?? null,
  repositoryName: (rp: any) => rp?.repositoryName,
}, {
  readAWS: async (awsClient: AWS, indexes: IndexedAWS) => {
    const t1 = Date.now();
    const repositories = indexes.get(Repository);
    if (!repositories) {
      throw new DepError('Need repositories to be loaded');
    }
    await Promise.all(Object.keys(repositories).map(async (k) => {
      try {
        const policy = (await awsClient.getECRRepositoryPolicy(k)) ?? null;
        indexes.set(RepositoryPolicy, 'repositoryName', policy);
      } catch (error) {
        console.log(`No policy for repository ${k}`);
      }
      return k;
    }));
    const t2 = Date.now();
    console.log(`RepositoryPolicy set in ${t2 - t1}ms`);
  },
  createAWS: async (obj: RepositoryPolicy, awsClient: AWS, indexes: IndexedAWS) => {
    try {
      let policy;
      // try {
      //   policy = `${JSON.parse(obj.policyText!)}`;
      // } catch (_) {
      // };
      policy = obj.policyText;
      console.log(`policy text = ${policy}`);
      const result = await awsClient.setECRRepositoryPolicy({
        repositoryName: obj.repository.repositoryName,
        policyText: policy,
      });
      // TODO: Handle if it fails (somehow)
      if (!result?.hasOwnProperty('repositoryName')) { // Failure
        throw new Error('what should we do here?');
      }
      const newRepositoryPolicy = await awsClient.getECRRepositoryPolicy(result.repositoryName ?? '');
      indexes.set(RepositoryPolicy, newRepositoryPolicy?.repositoryName ?? '', newRepositoryPolicy);
      const newEntity: RepositoryPolicy = await RepositoryPolicyMapper.fromAWS(newRepositoryPolicy, awsClient, indexes);
      newEntity.id = obj.id;
      for (const key of Object.keys(newEntity)) {
        (obj as any)[key] = (newEntity as any)[key];
      }
      return newEntity;
    } catch (e) {
      console.log(`failing on create error: ${JSON.stringify(e)}`)
      throw e;
    }
  },
  updateAWS: async (obj: RepositoryPolicy, awsClient: AWS, indexes: IndexedAWS) => {
    return RepositoryPolicyMapper.createAWS(obj, awsClient, indexes);
  },
  deleteAWS: async (obj: RepositoryPolicy, awsClient: AWS, indexes: IndexedAWS) => {
    await awsClient.deleteECRRepositoryPolicy(obj.repository.repositoryName);
    // TODO: What does the error even look like? Docs are spotty on this
    indexes.del(RepositoryPolicy, (obj as any).repository.repositoryName);
    return obj;
  },
});
