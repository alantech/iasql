import { In, } from 'typeorm'

import { Repository, } from '@aws-sdk/client-ecr'
import { Repository as PublicRepository, } from '@aws-sdk/client-ecr-public'

import { AWS, } from '../../services/gateways/aws'
import { AwsPublicRepository, AwsRepository, AwsRepositoryPolicy, ImageTagMutability, } from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEcr1637082183230, } from './migration/1637082183230-aws_ecr'

export const AwsEcrModule: Module = new Module({
  name: 'aws_ecr',
  dependencies: ['aws_account'],
  provides: {
    entities: allEntities,
    tables: ['aws_repository', 'aws_repository_policy'],
    functions: ['create_ecr_repository', 'create_ecr_repository_policy'],
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
      let same = true;
      for (const [key, value] of Object.entries(a)) {
        if (typeof value === 'object') {
          same = AwsEcrModule.utils.policyComparisonEq(a[key], b[key]);
        } else {
          if (a[key] !== b[key]) same = false;
        }
      }
      return same;
    }
  },
  mappers: {
    publicRepository: new Mapper<AwsPublicRepository>({
      entity: AwsPublicRepository,
      entityId: (e: AwsPublicRepository) => e?.repositoryName ?? '',
      entityPrint: (e: AwsPublicRepository) => ({
        id: e?.id?.toString() ?? '',
        repositoryName: e?.repositoryName ?? '',
        repositoryArn: e?.repositoryArn ?? '',
        registryId: e?.registryId ?? '',
        repositoryUri: e?.repositoryUri ?? '',
        createdAt: e?.createdAt?.toISOString() ?? '',
      }),
      equals: (a: AwsPublicRepository, b: AwsPublicRepository) => Object.is(a.repositoryName, b.repositoryName),
      source: 'db',
      db: new Crud({
        create: (e: AwsPublicRepository | AwsPublicRepository[], ctx: Context) => ctx.orm.save(AwsPublicRepository, e),
        read: async (ctx: Context, id?: string | string[] | undefined) => ctx.orm.find(
          AwsPublicRepository,
          id ? {
            where: {
              repositoryName: Array.isArray(id) ? In(id) : id,
            },
          } : undefined,
        ),
        update: (e: AwsPublicRepository | AwsPublicRepository[], ctx: Context) => ctx.orm.save(AwsPublicRepository, e),
        delete: (e: AwsPublicRepository | AwsPublicRepository[], ctx: Context) => ctx.orm.remove(AwsPublicRepository, e),
      }),
      cloud: new Crud({
        create: async (sg: AwsPublicRepository | AwsPublicRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(sg) ? sg : [sg];
          return await Promise.all(es.map(async (e) => {
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
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const ecrs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getECRPubRepository(id))) :
            ids === undefined ?
              (await client.getECRPubRepositories()).Repositories ?? [] :
              [await client.getECRPubRepository(ids)];
          return await Promise.all(ecrs.map(
            ecr => AwsEcrModule.utils.publicRepositoryMapper(ecr, ctx)
          ));
        },
        update: async (r: AwsPublicRepository | AwsPublicRepository[], ctx: Context) => {
          const es = Array.isArray(r) ? r : [r];
          return await Promise.all(es.map(async (e) => {
            try {
              return await AwsEcrModule.mappers.publicRepository.cloud.create(e, ctx);
            } catch (_) {
              e.repositoryName = Date.now().toString();
              return await AwsEcrModule.mappers.publicRepository.cloud.create(e, ctx);
            }
          }));
        },
        delete: async (r: AwsPublicRepository | AwsPublicRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(r) ? r : [r];
          await Promise.all(es.map(async (e) => {
            await client.deleteECRPubRepository(e.repositoryName!);
          }));
        },
      }),
    }),
    repository: new Mapper<AwsRepository>({
      entity: AwsRepository,
      entityId: (e: AwsRepository) => e?.repositoryName ?? '',
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
      equals: (a: AwsRepository, b: AwsRepository) => Object.is(a.imageTagMutability, b.imageTagMutability)
        && Object.is(a.scanOnPush, b.scanOnPush),
      source: 'db',
      db: new Crud({
        create: (e: AwsRepository | AwsRepository[], ctx: Context) => ctx.orm.save(AwsRepository, e),
        read: async (ctx: Context, id?: string | string[] | undefined) => ctx.orm.find(
          AwsRepository,
          id ? {
            where: {
              repositoryName: Array.isArray(id) ? In(id) : id,
            },
          } : undefined),
        update: (e: AwsRepository | AwsRepository[], ctx: Context) => ctx.orm.save(AwsRepository, e),
        delete: (e: AwsRepository | AwsRepository[], ctx: Context) => ctx.orm.remove(AwsRepository, e),
      }),
      cloud: new Crud({
        create: async (sg: AwsRepository | AwsRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(sg) ? sg : [sg];
          return await Promise.all(es.map(async (e) => {
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
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const ecrs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getECRRepository(id))) :
            ids === undefined ?
              (await client.getECRRepositories()).Repositories ?? [] :
              [await client.getECRRepository(ids)];
          return await Promise.all(ecrs.map(
            ecr => AwsEcrModule.utils.repositoryMapper(ecr, ctx)
          ));
        },
        update: async (r: AwsRepository | AwsRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(r) ? r : [r];
          return await Promise.all(es.map(async (e) => {
            const input = {
              repositoryName: e.repositoryName,
              imageTagMutability: e.imageTagMutability,
              scanOnPush: e.scanOnPush,
            };
            const updatedRepository = await client.updateECRRepository(input);
            return AwsEcrModule.utils.repositoryMapper(updatedRepository, ctx);
          }));
        },
        delete: async (r: AwsRepository | AwsRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(r) ? r : [r];
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
      entityId: (e: AwsRepositoryPolicy) => e.repository?.repositoryName + '',
      entityPrint: (e: AwsRepositoryPolicy) => ({
        id: e?.id?.toString() ?? '',
        registryId: e?.registryId ?? '',
        repository: e?.repository?.repositoryName ?? '',
        policyText: e?.policyText ?? '',
      }),
      equals: (a: AwsRepositoryPolicy, b: AwsRepositoryPolicy) => {
        try {
          return AwsEcrModule.utils.policyComparisonEq(JSON.parse(a.policyText!), JSON.parse(b.policyText!));
        } catch (e) {
          return false;
        }
      },
      source: 'db',
      db: new Crud({
        create: (e: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => ctx.orm.save(AwsRepositoryPolicy, e),
        read: async (ctx: Context, id?: string | string[] | undefined) => ctx.orm.find(
          AwsRepositoryPolicy,
          id ? {
            where: {
              repository: { repositoryName: id }
            },
            relations: [ 'repository', ],
          } : { relations: [ 'repository', ], }),
        update: async (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => {
          const es = Array.isArray(rp) ? rp : [rp];
          for (const e of es) {
            if (!e.repository.id) {
              const r = await AwsEcrModule.mappers.repository.db.read(ctx, e.repository.repositoryName);
              if (!r?.id) throw new Error('Error retrieving generated column');
              e.repository.id = r.id;
            }
          }
          await ctx.orm.save(AwsRepositoryPolicy, es);
        },
        delete: (e: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => ctx.orm.remove(AwsRepositoryPolicy, e),
      }),
      cloud: new Crud({
        create: async (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(rp) ? rp : [rp];
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
        read: async (ctx: Context, ids?: string | string[]) => {
          // TODO: Can this function be refactored to be simpler?
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            ids = Array.isArray(ids) ? ids : [ids];
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
        update: (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => AwsEcrModule.mappers.repositoryPolicy.cloud.create(rp, ctx),
        delete: async (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(rp) ? rp : [rp];
          await Promise.all(es.map(async (e) => {
            try {
              await client.deleteECRRepositoryPolicy(e.repository.repositoryName!);
            } catch (e: any) {
              // Do nothing if repository not found. It means the repository got deleted first and the policy has already been removed
              if (e.name !== 'RepositoryNotFoundException') {
                throw e;
              }
            }
          }));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsEcr1637082183230.prototype.up,
    preremove: awsEcr1637082183230.prototype.down,
  },
});
