import { ECR, Repository as RepositoryAws, paginateDescribeRepositories } from '@aws-sdk/client-ecr';
import {
  ECRPUBLIC,
  Repository as PublicRepositoryAws,
  paginateDescribeRepositories as paginateDescribePubRepositories,
} from '@aws-sdk/client-ecr-public';

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import logger from '../../../services/logger';
import { PublicRepository, Repository, RepositoryPolicy, ImageTagMutability } from './entity';
import { Context, Crud2, Mapper2, Module2 } from '../../interfaces';
import * as metadata from './module.json';

const createECRPubRepository = crudBuilderFormat<ECRPUBLIC, 'createRepository', RepositoryAws | undefined>(
  'createRepository',
  input => input,
  res => res?.repository
);
const getECRPubRepository = crudBuilderFormat<ECRPUBLIC, 'describeRepositories', RepositoryAws | undefined>(
  'describeRepositories',
  name => ({ repositoryNames: [name] }),
  res => (res?.repositories ?? [])[0]
);
const getECRPubRepositories = paginateBuilder<ECRPUBLIC>(paginateDescribePubRepositories, 'repositories');
const deleteECRPubRepository = crudBuilderFormat<ECRPUBLIC, 'deleteRepository', undefined>(
  'deleteRepository',
  repositoryName => ({ repositoryName }),
  _res => undefined
);
const createECRRepository = crudBuilderFormat<ECR, 'createRepository', RepositoryAws | undefined>(
  'createRepository',
  input => input,
  res => res?.repository
);
const getECRRepository = crudBuilderFormat<ECR, 'describeRepositories', RepositoryAws | undefined>(
  'describeRepositories',
  name => ({ repositoryNames: [name] }),
  res => (res?.repositories ?? [])[0]
);
const getECRRepositories = paginateBuilder<ECR>(paginateDescribeRepositories, 'repositories');
const updateECRRepositoryImageTagMutability = crudBuilderFormat<ECR, 'putImageTagMutability', undefined>(
  'putImageTagMutability',
  (repositoryName, imageTagMutability) => ({ repositoryName, imageTagMutability }),
  _res => undefined
);
const updateECRRepositoryImageScanningConfiguration = crudBuilderFormat<
  ECR,
  'putImageScanningConfiguration',
  undefined
>(
  'putImageScanningConfiguration',
  (repositoryName, scanOnPush) => ({
    repositoryName,
    imageScanningConfiguration: { scanOnPush },
  }),
  _res => undefined
);
const deleteECRRepository = crudBuilderFormat<ECR, 'deleteRepository', undefined>(
  'deleteRepository',
  repositoryName => ({ repositoryName }),
  _res => undefined
);
const setECRRepositoryPolicy = crudBuilder2<ECR, 'setRepositoryPolicy'>('setRepositoryPolicy', input => input);
const getECRRepositoryPolicy = crudBuilder2<ECR, 'getRepositoryPolicy'>('getRepositoryPolicy', repositoryName => ({
  repositoryName,
}));
const deleteECRRepositoryPolicy = crudBuilder2<ECR, 'deleteRepositoryPolicy'>(
  'deleteRepositoryPolicy',
  repositoryName => ({ repositoryName })
);

export const AwsEcrModule: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      publicRepositoryMapper: (r: PublicRepositoryAws) => {
        const out = new PublicRepository();
        if (!r?.repositoryName) return undefined;
        out.repositoryName = r.repositoryName;
        out.repositoryArn = r.repositoryArn;
        out.registryId = r.registryId;
        out.repositoryUri = r.repositoryUri;
        out.createdAt = r.createdAt ? new Date(r.createdAt) : r.createdAt;
        return out;
      },
      repositoryMapper: (r: RepositoryAws) => {
        const out = new Repository();
        if (!r?.repositoryName) return undefined;
        out.repositoryName = r.repositoryName;
        out.repositoryArn = r.repositoryArn;
        out.registryId = r.registryId;
        out.repositoryUri = r.repositoryUri;
        out.createdAt = r.createdAt ? new Date(r.createdAt) : r.createdAt;
        out.imageTagMutability = (r.imageTagMutability as ImageTagMutability) ?? ImageTagMutability.MUTABLE;
        out.scanOnPush = r.imageScanningConfiguration?.scanOnPush ?? false;
        return out;
      },
      repositoryPolicyMapper: async (rp: any, ctx: Context) => {
        const out = new RepositoryPolicy();
        out.registryId = rp?.registryId;
        out.repository =
          ctx.memo?.cloud?.Repository?.[rp.repositoryName] ??
          (await AwsEcrModule.mappers.repository.cloud.read(ctx, rp?.repositoryName));
        out.policyText = rp?.policyText?.replace(/\n/g, '').replace(/\s+/g, ' ') ?? null;
        return out;
      },
      policyComparisonEq: (a: any, b: any) => {
        // From https://stackoverflow.com/questions/44792629/how-to-compare-two-objects-with-nested-array-of-object-using-loop
        let same = Object.keys(a).length === Object.keys(b).length;
        if (!same) return same;
        for (const [key, value] of Object.entries(a)) {
          if (typeof value === 'object') {
            same = AwsEcrModule.utils.policyComparisonEq(a[key], b[key]);
          } else {
            if (a[key] !== b[key]) {
              same = false;
              break;
            }
          }
        }
        return same;
      },
    },
    mappers: {
      publicRepository: new Mapper2<PublicRepository>({
        entity: PublicRepository,
        equals: (a: PublicRepository, b: PublicRepository) =>
          Object.is(a.repositoryName, b.repositoryName) &&
          Object.is(a.repositoryArn, b.repositoryArn) &&
          Object.is(a.registryId, b.registryId) &&
          Object.is(a.repositoryUri, b.repositoryUri) &&
          Object.is(a.createdAt?.getTime(), b.createdAt?.getTime()),
        source: 'db',
        cloud: new Crud2({
          create: async (es: PublicRepository[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              const result = await createECRPubRepository(client.ecrPubClient, {
                repositoryName: e.repositoryName,
              });
              // TODO: Handle if it fails (somehow)
              if (!result?.hasOwnProperty('repositoryArn')) {
                // Failure
                throw new Error('what should we do here?');
              }
              // Re-get the inserted record to get all of the relevant records we care about
              const newObject = await getECRPubRepository(client.ecrPubClient, result.repositoryName ?? '');
              // We map this into the same kind of entity as `obj`
              const newEntity = await AwsEcrModule.utils.publicRepositoryMapper(newObject, ctx);
              // Save the record back into the database to get the new fields updated
              await AwsEcrModule.mappers.publicRepository.db.update(newEntity, ctx);
              out.push(newEntity);
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const rawEcr = await getECRPubRepository(client.ecrPubClient, id);
              if (!rawEcr) return;
              return AwsEcrModule.utils.publicRepositoryMapper(rawEcr);
            } else {
              const ecrs = (await getECRPubRepositories(client.ecrPubClient)) ?? [];
              return ecrs.map(ecr => AwsEcrModule.utils.publicRepositoryMapper(ecr));
            }
          },
          updateOrReplace: () => 'update',
          update: async (es: PublicRepository[], ctx: Context) => {
            // Right now we can only modify AWS-generated fields in the database.
            // This implies that on `update`s we only have to restore the db values with the cloud records.
            const out = [];
            for (const e of es) {
              const cloudRecord = ctx?.memo?.cloud?.PublicRepository?.[e.repositoryName ?? ''];
              await AwsEcrModule.mappers.publicRepository.db.update(cloudRecord, ctx);
              out.push(cloudRecord);
            }
            return out;
          },
          delete: async (es: PublicRepository[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              await deleteECRPubRepository(client.ecrPubClient, e.repositoryName!);
            }
          },
        }),
      }),
      repository: new Mapper2<Repository>({
        entity: Repository,
        equals: (a: Repository, b: Repository) =>
          Object.is(a.repositoryName, b.repositoryName) &&
          Object.is(a.repositoryArn, b.repositoryArn) &&
          Object.is(a.registryId, b.registryId) &&
          Object.is(a.repositoryUri, b.repositoryUri) &&
          Object.is(a.createdAt?.getTime(), b.createdAt?.getTime()) &&
          Object.is(a.imageTagMutability, b.imageTagMutability) &&
          Object.is(a.scanOnPush, b.scanOnPush),
        source: 'db',
        cloud: new Crud2({
          create: async (es: Repository[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              const result = await createECRRepository(client.ecrClient, {
                repositoryName: e.repositoryName,
                imageTagMutability: e.imageTagMutability,
                imageScanningConfiguration: {
                  scanOnPush: e.scanOnPush,
                },
              });
              // TODO: Handle if it fails (somehow)
              if (!result?.hasOwnProperty('repositoryArn')) {
                // Failure
                throw new Error('what should we do here?');
              }
              // Re-get the inserted record to get all of the relevant records we care about
              const newObject = await getECRRepository(client.ecrClient, result.repositoryName ?? '');
              // We map this into the same kind of entity as `obj`
              const newEntity = await AwsEcrModule.utils.repositoryMapper(newObject, ctx);
              // Save the record back into the database to get the new fields updated
              await AwsEcrModule.mappers.repository.db.update(newEntity, ctx);
              out.push(newEntity);
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const rawEcr = await getECRRepository(client.ecrClient, id);
              if (!rawEcr) return;
              return AwsEcrModule.utils.repositoryMapper(rawEcr);
            } else {
              const ecrs = (await getECRRepositories(client.ecrClient)) ?? [];
              return ecrs.map(ecr => AwsEcrModule.utils.repositoryMapper(ecr));
            }
          },
          updateOrReplace: () => 'update',
          update: async (es: Repository[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              const cloudRecord = ctx?.memo?.cloud?.Repository?.[e.repositoryName ?? ''];
              let updatedRecord = { ...cloudRecord };
              if (cloudRecord?.imageTagMutability !== e.imageTagMutability) {
                await updateECRRepositoryImageTagMutability(client.ecrClient, e.repositoryName, e.imageTagMutability);
                const updatedRepository = await getECRRepository(client.ecrClient, e.repositoryName);
                updatedRecord = AwsEcrModule.utils.repositoryMapper(updatedRepository, ctx);
              }
              if (cloudRecord?.scanOnPush !== e.scanOnPush) {
                await updateECRRepositoryImageScanningConfiguration(client.ecrClient, e.repositoryName, e.scanOnPush);
                const updatedRepository = await getECRRepository(client.ecrClient, e.repositoryName);
                updatedRecord = AwsEcrModule.utils.repositoryMapper(updatedRepository, ctx);
              }
              await AwsEcrModule.mappers.repository.db.update(updatedRecord, ctx);
              out.push(updatedRecord);
            }
            return out;
          },
          delete: async (es: Repository[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              await deleteECRRepository(client.ecrClient, e.repositoryName!);
              // Also need to delete the repository policy associated with this repository,
              // if any
              const policy = await AwsEcrModule.mappers.repositoryPolicy.db.read(ctx, e.repositoryName);
              await AwsEcrModule.mappers.repositoryPolicy.db.delete(policy, ctx);
            }
          },
        }),
      }),
      repositoryPolicy: new Mapper2<RepositoryPolicy>({
        entity: RepositoryPolicy,
        entityId: (e: RepositoryPolicy) => e.repository?.repositoryName + '' ?? e.id.toString(),
        equals: (a: RepositoryPolicy, b: RepositoryPolicy) => {
          try {
            return (
              Object.is(a.registryId, b.registryId) &&
              Object.is(a.repository.repositoryName, b.repository.repositoryName) &&
              AwsEcrModule.utils.policyComparisonEq(JSON.parse(a.policyText!), JSON.parse(b.policyText!))
            );
          } catch (e) {
            return false;
          }
        },
        source: 'db',
        cloud: new Crud2({
          create: async (es: RepositoryPolicy[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              const result = await setECRRepositoryPolicy(client.ecrClient, {
                repositoryName: e.repository.repositoryName,
                policyText: e.policyText,
              });
              // TODO: Handle if it fails (somehow)
              if (!result?.hasOwnProperty('repositoryName')) {
                // Failure
                throw new Error('what should we do here?');
              }
              // Re-get the inserted record to get all of the relevant records we care about
              const newObject = await getECRRepositoryPolicy(client.ecrClient, result.repositoryName ?? '');
              // We map this into the same kind of entity as `obj`
              const newEntity = await AwsEcrModule.utils.repositoryPolicyMapper(newObject, ctx);
              // We attach the original object's ID to this new one, indicating the exact record it is
              // replacing in the database.
              newEntity.id = e.id;
              // Save the record back into the database to get the new fields updated
              await AwsEcrModule.mappers.repositoryPolicy.db.update(newEntity, ctx);
              out.push(newEntity);
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            // TODO: Can this function be refactored to be simpler?
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const rawRepositoryPolicy = await getECRRepositoryPolicy(client.ecrClient, id);
              return await AwsEcrModule.utils.repositoryPolicyMapper(rawRepositoryPolicy, ctx);
            } else {
              const repositories = ctx.memo?.cloud?.Repository
                ? Object.values(ctx.memo?.cloud?.Repository)
                : await AwsEcrModule.mappers.repository.cloud.read(ctx);
              const policies: any = [];
              for (const r of repositories) {
                try {
                  const rp = await getECRRepositoryPolicy(client.ecrClient, r.repositoryName);
                  policies.push(rp);
                } catch (_) {
                  // We try to retrieve the policy for the repository, but if none it is not an error
                  continue;
                }
              }
              const out = [];
              for (const rp of policies) {
                out.push(await AwsEcrModule.utils.repositoryPolicyMapper(rp, ctx));
              }
              return out;
            }
          },
          updateOrReplace: () => 'update',
          update: async (es: RepositoryPolicy[], ctx: Context) => {
            const out = [];
            for (const e of es) {
              const cloudRecord = ctx?.memo?.cloud?.RepositoryPolicy?.[e.repository.repositoryName ?? ''];
              try {
                if (
                  !AwsEcrModule.utils.policyComparisonEq(JSON.parse(cloudRecord.policyText!), JSON.parse(e.policyText!))
                ) {
                  return AwsEcrModule.mappers.repositoryPolicy.cloud.create(e, ctx);
                }
              } catch (e) {
                logger.error('Error comparing policy records');
              }
              cloudRecord.id = e.id;
              await AwsEcrModule.mappers.repositoryPolicy.db.update(cloudRecord, ctx);
              out.push(cloudRecord);
            }
            return out;
          },
          delete: async (es: RepositoryPolicy[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              try {
                await deleteECRRepositoryPolicy(client.ecrClient, e.repository.repositoryName!);
              } catch (e: any) {
                // Do nothing if repository not found. It means the repository got deleted first and
                // the policy has already been removed
                if (e.name !== 'RepositoryNotFoundException') throw e;
              }
            }
          },
        }),
      }),
    },
  },
  __dirname
);
