import { Repository as RepositoryAws, } from '@aws-sdk/client-ecr'
import { Repository as PublicRepositoryAws, } from '@aws-sdk/client-ecr-public'

import { AWS, } from '../../../services/gateways/aws'
import logger from '../../../services/logger'
import { PublicRepository, Repository, RepositoryPolicy, ImageTagMutability, } from './entity'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import * as metadata from './module.json'

export const AwsEcrModule: Module = new Module({
  ...metadata,
  utils: {
    publicRepositoryMapper: (r: PublicRepositoryAws) => {
      const out = new Repository();
      if (!r?.repositoryName) throw new Error('No repository name defined.');
      out.repositoryName = r.repositoryName;
      out.repositoryArn = r.repositoryArn;
      out.registryId = r.registryId;
      out.repositoryUri = r.repositoryUri;
      out.createdAt = r.createdAt ? new Date(r.createdAt) : r.createdAt;
      return out;
    },
    repositoryMapper: (r: RepositoryAws) => {
      const out = new Repository();
      if (!r?.repositoryName) throw new Error('No repository name defined.');
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
      out.repository = ctx.memo?.cloud?.Repository?.[rp.repositoryName] ?? await AwsEcrModule.mappers.repository.cloud.read(ctx, rp?.repositoryName);
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
          };
        }
      }
      return same;
    }
  },
  mappers: {
    publicRepository: new Mapper<PublicRepository>({
      entity: PublicRepository,
      equals: (a: PublicRepository, b: PublicRepository) => Object.is(a.repositoryName, b.repositoryName)
        && Object.is(a.repositoryArn, b.repositoryArn)
        && Object.is(a.registryId, b.registryId)
        && Object.is(a.repositoryUri, b.repositoryUri)
        && Object.is(a.createdAt?.getTime(), b.createdAt?.getTime()),
      source: 'db',
      cloud: new Crud({
        create: async (es: PublicRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const result = await client.createECRPubRepository({
              repositoryName: e.repositoryName,
            });
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('repositoryArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getECRPubRepository(result.repositoryName ?? '');
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsEcrModule.utils.publicRepositoryMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsEcrModule.mappers.publicRepository.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const ecrs = Array.isArray(ids) ? await (async () => {
            const out = [];
            for (const id of ids) {
              out.push(await client.getECRPubRepository(id));
            }
            return out;
          })() :
            (await client.getECRPubRepositories()).Repositories ?? [];
          return ecrs.map(ecr => AwsEcrModule.utils.publicRepositoryMapper(ecr));
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
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.deleteECRPubRepository(e.repositoryName!);
          }
        },
      }),
    }),
    repository: new Mapper<Repository>({
      entity: Repository,
      equals: (a: Repository, b: Repository) => Object.is(a.repositoryName, b.repositoryName)
        && Object.is(a.repositoryArn, b.repositoryArn)
        && Object.is(a.registryId, b.registryId)
        && Object.is(a.repositoryUri, b.repositoryUri)
        && Object.is(a.createdAt?.getTime(), b.createdAt?.getTime())
        && Object.is(a.imageTagMutability, b.imageTagMutability)
        && Object.is(a.scanOnPush, b.scanOnPush),
      source: 'db',
      cloud: new Crud({
        create: async (es: Repository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const result = await client.createECRRepository({
              repositoryName: e.repositoryName,
              imageTagMutability: e.imageTagMutability,
              imageScanningConfiguration: {
                scanOnPush: e.scanOnPush,
              },
            });
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('repositoryArn')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getECRRepository(result.repositoryName ?? '');
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsEcrModule.utils.repositoryMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsEcrModule.mappers.repository.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const ecrs = Array.isArray(ids) ? await (async () => {
            const out = [];
            for (const id of ids) {
              out.push(await client.getECRRepository(id));
            }
            return out;
          })() :
            (await client.getECRRepositories()).Repositories ?? [];
          return ecrs.map(ecr => AwsEcrModule.utils.repositoryMapper(ecr));
        },
        updateOrReplace: () => 'update',
        update: async (es: Repository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Repository?.[e.repositoryName ?? ''];
            let updatedRecord = { ...cloudRecord };
            if (cloudRecord?.imageTagMutability !== e.imageTagMutability) {
              const updatedRepository = await client.updateECRRepositoryImageTagMutability(e.repositoryName, e.imageTagMutability);
              updatedRecord = AwsEcrModule.utils.repositoryMapper(updatedRepository, ctx);
            }
            if (cloudRecord?.scanOnPush !== e.scanOnPush) {
              const updatedRepository = await client.updateECRRepositoryImageScanningConfiguration(e.repositoryName, e.scanOnPush);
              updatedRecord = AwsEcrModule.utils.repositoryMapper(updatedRepository, ctx);
            }
            await AwsEcrModule.mappers.repository.db.update(updatedRecord, ctx);
            out.push(updatedRecord);
          }
          return out;
        },
        delete: async (es: Repository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.deleteECRRepository(e.repositoryName!);
            // Also need to delete the repository policy associated with this repository,
            // if any
            const policy = await AwsEcrModule.mappers.repositoryPolicy.db.read(ctx, e.repositoryName);
            await AwsEcrModule.mappers.repositoryPolicy.db.delete(policy, ctx);
          }
        },
      }),
    }),
    repositoryPolicy: new Mapper<RepositoryPolicy>({
      entity: RepositoryPolicy,
      entityId: (e: RepositoryPolicy) => e.repository?.repositoryName + '' ?? e.id.toString(),
      equals: (a: RepositoryPolicy, b: RepositoryPolicy) => {
        try {
          return Object.is(a.registryId, b.registryId)
            && Object.is(a.repository.repositoryName, b.repository.repositoryName)
            && AwsEcrModule.utils.policyComparisonEq(JSON.parse(a.policyText!), JSON.parse(b.policyText!));
        } catch (e) {
          return false;
        }
      },
      source: 'db',
      cloud: new Crud({
        create: async (es: RepositoryPolicy[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const result = await client.setECRRepositoryPolicy({
              repositoryName: e.repository.repositoryName,
              policyText: e.policyText,
            });
            // TODO: Handle if it fails (somehow)
            if (!result.hasOwnProperty('repositoryName')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getECRRepositoryPolicy(result.repositoryName ?? '');
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
        read: async (ctx: Context, ids?: string[]) => {
          // TODO: Can this function be refactored to be simpler?
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            const out = [];
            for (const id of ids) {
              out.push(await AwsEcrModule.utils.repositoryPolicyMapper(
                await client.getECRRepositoryPolicy(id), ctx
              ));
            }
            return out;
          } else {
            const repositories = ctx.memo?.cloud?.Repository ? Object.values(ctx.memo?.cloud?.Repository) : await AwsEcrModule.mappers.repository.cloud.read(ctx);
            const policies: any = [];
            for (const r of repositories) {
              try {
                const rp = await client.getECRRepositoryPolicy(r.repositoryName);
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
              if (!AwsEcrModule.utils.policyComparisonEq(JSON.parse(cloudRecord.policyText!), JSON.parse(e.policyText!))) {
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
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            try {
              await client.deleteECRRepositoryPolicy(e.repository.repositoryName!);
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
}, __dirname);
