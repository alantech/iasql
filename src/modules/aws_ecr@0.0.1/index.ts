import { In, } from 'typeorm'

import { Repository, } from '@aws-sdk/client-ecr'
import { Repository as PublicRepository, } from '@aws-sdk/client-ecr-public'

import { AWS, } from '../../services/gateways/aws'
import { AwsPublicRepository, AwsRepository, AwsRepositoryPolicy, ImageTagMutability, } from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import * as metadata from './module.json'

export const AwsEcrModule: Module = new Module({
  ...metadata,
  provides: {
    entities: allEntities,
    tables: ['aws_repository', 'aws_repository_policy', 'aws_public_repository',],
    functions: [
      'create_or_update_ecr_repository', 'create_or_update_ecr_repository_policy', 'create_or_update_ecr_public_repository',
      'delete_ecr_repository', 'delete_ecr_repository_policy', 'delete_ecr_public_repository',
    ],
  },
  utils: {
    publicRepositoryMapper: (r: PublicRepository, _ctx: Context) => {
      const out = new AwsRepository();
      if (!r?.repositoryName) throw new Error('No repository name defined.');
      out.repositoryName = r.repositoryName;
      out.repositoryArn = r.repositoryArn;
      out.registryId = r.registryId;
      out.repositoryUri = r.repositoryUri;
      out.createdAt = r.createdAt ? new Date(r.createdAt) : r.createdAt;
      return out;
    },
    repositoryMapper: (r: Repository, _ctx: Context) => {
      const out = new AwsRepository();
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
      const out = new AwsRepositoryPolicy();
      out.registryId = rp?.registryId;
      out.repository = ctx.memo?.cloud?.AwsRepository?.[rp.repositoryName] ?? await AwsEcrModule.mappers.repository.cloud.read(ctx, rp?.repositoryName);
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
    publicRepository: new Mapper<AwsPublicRepository>({
      entity: AwsPublicRepository,
      entityPrint: (e: AwsPublicRepository) => ({
        id: e?.id?.toString() ?? '',
        repositoryName: e?.repositoryName ?? '',
        repositoryArn: e?.repositoryArn ?? '',
        registryId: e?.registryId ?? '',
        repositoryUri: e?.repositoryUri ?? '',
        createdAt: e?.createdAt?.toISOString() ?? '',
      }),
      equals: (a: AwsPublicRepository, b: AwsPublicRepository) => Object.is(a.repositoryName, b.repositoryName)
        && Object.is(a.repositoryArn, b.repositoryArn)
        && Object.is(a.registryId, b.registryId)
        && Object.is(a.repositoryUri, b.repositoryUri)
        && Object.is(a.createdAt?.getTime(), b.createdAt?.getTime()),
      source: 'db',
      db: new Crud({
        create: (e: AwsPublicRepository[], ctx: Context) => ctx.orm.save(AwsPublicRepository, e),
        read: async (ctx: Context, ids?: string[]) => ctx.orm.find(AwsPublicRepository, ids ? {
          where: {
            repositoryName: In(ids),
          },
        } : undefined),
        update: (e: AwsPublicRepository[], ctx: Context) => ctx.orm.save(AwsPublicRepository, e),
        delete: (e: AwsPublicRepository[], ctx: Context) => ctx.orm.remove(AwsPublicRepository, e),
      }),
      cloud: new Crud({
        create: async (sg: AwsPublicRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(sg.map(async (e) => {
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
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsEcrModule.mappers.publicRepository.db.update(newEntity, ctx);
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const ecrs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getECRPubRepository(id))) :
            (await client.getECRPubRepositories()).Repositories ?? [];
          return await Promise.all(ecrs.map(
            ecr => AwsEcrModule.utils.publicRepositoryMapper(ecr, ctx)
          ));
        },
        updateOrReplace: () => 'update',
        update: async (es: AwsPublicRepository[], ctx: Context) => {
          // Right now we can only modify AWS-generated fields in the database.
          // This implies that on `update`s we only have to restore the db values with the cloud records.
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.AwsPublicRepository?.[e.repositoryName ?? ''];
            cloudRecord.id = e.id;
            await AwsEcrModule.mappers.publicRepository.db.update(cloudRecord, ctx);
            return cloudRecord;
          }));
        },
        delete: async (es: AwsPublicRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(async (e) => {
            await client.deleteECRPubRepository(e.repositoryName!);
          }));
        },
      }),
    }),
    repository: new Mapper<AwsRepository>({
      entity: AwsRepository,
      entityPrint: (e: AwsRepository) => ({
        id: e?.id?.toString() ?? '',
        repositoryName: e?.repositoryName ?? '',
        repositoryArn: e?.repositoryArn ?? '',
        registryId: e?.registryId ?? '',
        repositoryUri: e?.repositoryUri ?? '',
        createdAt: e?.createdAt?.toISOString() ?? '',
        imageTagMutability: e?.imageTagMutability ?? ImageTagMutability.MUTABLE,
        scanOnPush: e?.scanOnPush?.toString() ?? 'false',
      }),
      equals: (a: AwsRepository, b: AwsRepository) => Object.is(a.repositoryName, b.repositoryName)
        && Object.is(a.repositoryArn, b.repositoryArn)
        && Object.is(a.registryId, b.registryId)
        && Object.is(a.repositoryUri, b.repositoryUri)
        && Object.is(a.createdAt?.getTime(), b.createdAt?.getTime())
        && Object.is(a.imageTagMutability, b.imageTagMutability)
        && Object.is(a.scanOnPush, b.scanOnPush),
      source: 'db',
      db: new Crud({
        create: (e: AwsRepository[], ctx: Context) => ctx.orm.save(AwsRepository, e),
        read: async (ctx: Context, ids?: string[]) => ctx.orm.find(AwsRepository, ids ? {
          where: {
            repositoryName: In(ids),
          },
        } : undefined),
        update: (e: AwsRepository[], ctx: Context) => ctx.orm.save(AwsRepository, e),
        delete: (e: AwsRepository[], ctx: Context) => ctx.orm.remove(AwsRepository, e),
      }),
      cloud: new Crud({
        create: async (sg: AwsRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(sg.map(async (e) => {
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
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsEcrModule.mappers.repository.db.update(newEntity, ctx);
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const ecrs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getECRRepository(id))) :
            (await client.getECRRepositories()).Repositories ?? [];
          return await Promise.all(ecrs.map(
            ecr => AwsEcrModule.utils.repositoryMapper(ecr, ctx)
          ));
        },
        updateOrReplace: () => 'update',
        update: async (es: AwsRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.AwsRepository?.[e.repositoryName ?? ''];
            let updatedRecord = { ...cloudRecord };
            if (cloudRecord?.imageTagMutability !== e.imageTagMutability) {
              const updatedRepository = await client.updateECRRepositoryImageTagMutability(e.repositoryName, e.imageTagMutability);
              updatedRecord = AwsEcrModule.utils.repositoryMapper(updatedRepository, ctx);
            }
            if (cloudRecord?.scanOnPush !== e.scanOnPush) {
              const updatedRepository = await client.updateECRRepositoryImageScanningConfiguration(e.repositoryName, e.scanOnPush);
              updatedRecord = AwsEcrModule.utils.repositoryMapper(updatedRepository, ctx);
            }
            updatedRecord.id = e.id;
            await AwsEcrModule.mappers.repository.db.update(updatedRecord, ctx);
            return updatedRecord;
          }));
        },
        delete: async (es: AwsRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(async (e) => {
            await client.deleteECRRepository(e.repositoryName!);
            // Also need to delete the repository policy associated with this repository,
            // if any
            const policy = await AwsEcrModule.mappers.repositoryPolicy.db.read(ctx, e.repositoryName);
            await AwsEcrModule.mappers.repositoryPolicy.db.delete(policy, ctx);
          }));
        },
      }),
    }),
    repositoryPolicy: new Mapper<AwsRepositoryPolicy>({
      entity: AwsRepositoryPolicy,
      entityId: (e: AwsRepositoryPolicy) => e.repository?.repositoryName + '' ?? e.id.toString(),
      entityPrint: (e: AwsRepositoryPolicy) => ({
        id: e?.id?.toString() ?? '',
        registryId: e?.registryId ?? '',
        repository: e?.repository?.repositoryName ?? '',
        policyText: e?.policyText ?? '',
      }),
      equals: (a: AwsRepositoryPolicy, b: AwsRepositoryPolicy) => {
        try {
          return Object.is(a.registryId, b.registryId)
            && Object.is(a.repository.repositoryName, b.repository.repositoryName)
            && AwsEcrModule.utils.policyComparisonEq(JSON.parse(a.policyText!), JSON.parse(b.policyText!));
        } catch (e) {
          return false;
        }
      },
      source: 'db',
      db: new Crud({
        create: (e: AwsRepositoryPolicy[], ctx: Context) => ctx.orm.save(AwsRepositoryPolicy, e),
        read: async (ctx: Context, ids?: string[]) => ctx.orm.find(AwsRepositoryPolicy, ids ? {
          where: {
            repository: { repositoryName: In(ids), }
          },
          relations: [ 'repository', ],
        } : { relations: [ 'repository', ], }),
        update: async (es: AwsRepositoryPolicy[], ctx: Context) => {
          for (const e of es) {
            if (!e.repository.id) {
              const r = await AwsEcrModule.mappers.repository.db.read(ctx, e.repository.repositoryName);
              if (!r?.id) throw new Error('Error retrieving generated column');
              e.repository.id = r.id;
            }
          }
          await ctx.orm.save(AwsRepositoryPolicy, es);
        },
        delete: (e: AwsRepositoryPolicy[], ctx: Context) => ctx.orm.remove(AwsRepositoryPolicy, e),
      }),
      cloud: new Crud({
        create: async (es: AwsRepositoryPolicy[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
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
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          // TODO: Can this function be refactored to be simpler?
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            return await Promise.all(ids.map(async (id) => {
              return await AwsEcrModule.utils.repositoryPolicyMapper(
                await client.getECRRepositoryPolicy(id), ctx
              );
            }));
          } else {
            const repositories = ctx.memo?.cloud?.AwsRepository ? Object.values(ctx.memo?.cloud?.AwsRepository) : await AwsEcrModule.mappers.repository.cloud.read(ctx);
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
            return await Promise.all(policies.map(async (rp: any) => {
              return await AwsEcrModule.utils.repositoryPolicyMapper(rp, ctx);
            }));
          }
        },
        updateOrReplace: () => 'update',
        update: async (es: AwsRepositoryPolicy[], ctx: Context) => {
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.AwsRepositoryPolicy?.[e.repository.repositoryName ?? ''];
            try {
              if (!AwsEcrModule.utils.policyComparisonEq(JSON.parse(cloudRecord.policyText!), JSON.parse(e.policyText!))) {
                return AwsEcrModule.mappers.repositoryPolicy.cloud.create(e, ctx);
              }
            } catch (e) {
              console.log('Error comparing policy records');
            }
            cloudRecord.id = e.id;
            await AwsEcrModule.mappers.repositoryPolicy.db.update(cloudRecord, ctx);
            return cloudRecord;
          }));
        },
        delete: async (es: AwsRepositoryPolicy[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(async (e) => {
            try {
              await client.deleteECRRepositoryPolicy(e.repository.repositoryName!);
            } catch (e: any) {
              // Do nothing if repository not found. It means the repository got deleted first and
              // the policy has already been removed
              if (e.name !== 'RepositoryNotFoundException') throw e;
            }
          }));
        },
      }),
    }),
  },
}, __dirname);
