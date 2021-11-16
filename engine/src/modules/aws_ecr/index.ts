import { In, } from 'typeorm'

import { Repository, } from '@aws-sdk/client-ecr'

import { AWS, } from '../../services/gateways/aws'
import { AwsRepository, AwsRepositoryPolicy, ImageTagMutability, } from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEcr1637073323677, } from './migration/1637073323677-aws_ecr'

export const AwsEcrModule: Module = new Module({
  name: 'aws_ecr',
  dependencies: ['aws_account'],
  provides: {
    tables: ['aws_repository', 'aws_repository_policy'],
  },
  utils: {
    repositoryMapper: async (r: Repository, _ctx: Context) => {
      const out = new AwsRepository();
      out.repositoryName = r?.repositoryName;
      out.repositoryArn = r?.repositoryArn;
      out.registryId = r?.registryId;
      out.repositoryUri = r?.repositoryUri;
      out.createdAt = r?.createdAt ? new Date(r.createdAt) : r.createdAt;
      out.imageTagMutability = (r?.imageTagMutability as ImageTagMutability | undefined);
      out.scanOnPush = r?.imageScanningConfiguration?.scanOnPush;
      return out;
    },
    repositoryPolicyMapper: async (rp: any, ctx: Context) => {
      const out = new AwsRepositoryPolicy();
      out.registryId = rp?.registryId;
      out.repository = ctx.memo?.db?.AwsRepository?.rp?.repositoryName ?? await AwsEcrModule.mappers.repository.cloud.read(ctx, rp?.repositoryName);
      out.policyText = rp?.policyText ?? false;
      return out;
    },
  },
  mappers: {
    repository: new Mapper<AwsRepository>({
      entity: AwsRepository,
      entityId: (e: AwsRepository) => e?.repositoryName ?? '',
      equals: (a: AwsRepository, b: AwsRepository) => Object.is(a.imageTagMutability, b.imageTagMutability)
        && Object.is(a.scanOnPush, b.scanOnPush),
      source: 'db',
      db: new Crud({
        create: async (e: AwsRepository | AwsRepository[], ctx: Context) => { await ctx.orm.save(AwsRepository, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const r = await ctx.orm.find(AwsRepository, id ? {
            where: {
              groupId: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
          return r;
        },
        update: async (e: AwsRepository | AwsRepository[], ctx: Context) => { await ctx.orm.save(AwsRepository, e); },
        delete: async (e: AwsRepository | AwsRepository[], ctx: Context) => { await ctx.orm.remove(AwsRepository, e);},
      }),
      cloud: new Crud({
        create: async (sg: AwsRepository | AwsRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(sg) ? sg : [sg];
          const out = await Promise.all(es.map(async (e) => {
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
            // replacing in the database, and also make a proper, complete loop for it as the rules
            // reference their parent in a circular fashion.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsEcrModule.mappers.repository.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(sg)) {
            return out;
          } else {
            return out[0];
          }
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsEcrModule.utils.repositoryMapper(
                  await client.getECRRepository(id), ctx
                );
              }));
            } else {
              return await AwsEcrModule.utils.repositoryMapper(
                await client.getECRRepository(ids), ctx
              );
            }
          } else {
            const repositories = (await client.getECRRepositories())?.Repositories ?? [];
            return await Promise.all(
              repositories.map((r: any) => AwsEcrModule.utils.repositoryMapper(r, ctx))
            );
          }
        },
        update: async (r: AwsRepository | AwsRepository[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(r) ? r : [r];
          return await Promise.all(es.map(async (e) => {
            const input = {
              repositoryName: e.repositoryName!,
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
      equals: (a: AwsRepositoryPolicy, b: AwsRepositoryPolicy) => Object.is(a.policyText, b.policyText),
      source: 'db',
      db: new Crud({
        create: async (e: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => { await ctx.orm.save(AwsRepositoryPolicy, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const out = await ctx.orm.find(AwsRepositoryPolicy, id ? {
            where: {
              repository: { repositoryName: id }
            },
            relations: ["repository"]
          } : { relations: ["repository"] });
          return out;
        },
        update: async (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => {
          const es = Array.isArray(rp) ? rp : [rp];
          for (const e of es) {
            if (!e.repository?.id) {
              const r = await AwsEcrModule.mappers.repository.db.read(ctx, e.repository?.repositoryName);
              e.repository = r;
            }
          }
          await ctx.orm.save(AwsRepositoryPolicy, es);
        },
        delete: async (e: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => { await ctx.orm.remove(AwsRepositoryPolicy, e); },
      }),
      cloud: new Crud({
        create: async (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(rp) ? rp : [rp];
          const out = await Promise.all(es.map(async (e) => {
            const result = await client.setECRRepositoryPolicy({
              repositoryName: e.repository?.repositoryName,
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
            // replacing in the database, and also make a proper, complete loop for it as the rules
            // reference their parent in a circular fashion.
            newEntity.id = e.id;
            // Save the record back into the database to get the new fields updated
            await AwsEcrModule.mappers.repositoryPolicy.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(rp)) {
            return out;
          } else {
            return out[0];
          }
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsEcrModule.utils.repositoryPolicyMapper(
                  await client.getECRRepositoryPolicy(id), ctx
                );
              }));
            } else {
              return await AwsEcrModule.utils.repositoryPolicyMapper(
                await client.getECRRepositoryPolicy(ids), ctx
              );
            }
          } else {
            const repositories = ctx.memo?.cloud?.AwsRepository ? Object.values(ctx.memo?.cloud?.AwsRepository) : await AwsEcrModule.mappers.repository.cloud.read(ctx);
            const policies: any = [];
            for (const r of repositories) {
              try {
                const rp = await client.getECRRepositoryPolicy(r.repositoryName);
                policies.push(rp);
              } catch (_) {
                // We try to retrieve the policy for the repositoru, but if any it is not an error
                continue;
              }
            }
            return await Promise.all(policies.map(async (rp: any) => {
              return await AwsEcrModule.utils.repositoryPolicyMapper(rp, ctx);
            }));
          }
        },
        update: async (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => {
          await AwsEcrModule.mappers.repositoryPolicy.cloud.create(rp, ctx);
        },
        delete: async (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(rp) ? rp : [rp];
          await Promise.all(es.map(async (e) => {
            try {
              await client.deleteECRRepositoryPolicy(e.repository?.repositoryName!);
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
    postinstall: awsEcr1637073323677.prototype.up,
    preremove: awsEcr1637073323677.prototype.down,
  },
});
