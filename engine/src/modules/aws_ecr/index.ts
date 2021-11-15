import { In, } from 'typeorm'

import { Repository, } from '@aws-sdk/client-ecr'

import { AWS, } from '../../services/gateways/aws'
import { AwsRepository, AwsRepositoryPolicy, ImageTagMutability, } from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsEcr1636993401097, } from './migration/1636993401097-aws_ecr'

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
    },
    repositoryPolicyMapper: async (rp: any, ctx: Context) => {
      const out = new AwsRepositoryPolicy();
      out.registryId = rp?.registryId;
      out.repository = await AwsEcrModule.mappers.repository.cloud.read(ctx, rp?.repositoryName);
      out.policyText = rp?.policyText ?? false;
      return out;
    },
  },
  mappers: {
    repository: new Mapper<AwsRepository>({
      entity: AwsRepository,
      entityId: (e: AwsRepository) => e.repositoryName ?? '',
      equals: (a: AwsRepository, b: AwsRepository) => Object.is(a.imageTagMutability, b.imageTagMutability)
        && Object.is(a.scanOnPush, b.scanOnPush),
      source: 'db',
      db: new Crud({
        create: async (e: AwsRepository | AwsRepository[], ctx: Context) => {
          await ctx.orm.save(AwsRepository, e);
        },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const r = await ctx.orm.find(AwsRepository, id ? {
            where: {
              groupId: Array.isArray(id) ? In(id) : id,
            },
          } : undefined);
          return r;
        },
        update: async (e: AwsRepository | AwsRepository[], ctx: Context) => {
          await ctx.orm.save(AwsRepository, e);
        },
        delete: async (e: AwsRepository | AwsRepository[], ctx: Context) => {
          await ctx.orm.remove(AwsRepository, e);
        },
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
          // const es = Array.isArray(r) ? r : [r];
          // return await Promise.all(es.map(async (e) => {
          //   // AWS does not have a way to update the top-level SecurityGroup entity. You can update
          //   // the various rules associated with it, but not the name or description of the
          //   // SecurityGroup itself. This may seem counter-intuitive, but we only need to create the
          //   // security group in AWS and *eventually* the old one will be removed. Why? Because on
          //   // the second pass of the checking algorithm (it always performs another pass if it
          //   // performed any change, and only stops once it determines nothing needs to be changed
          //   // anymore), it will see a security group in AWS that it doesn't have a record for and
          //   // then remove it since the database is supposed to be the source of truth. Further,
          //   // because of the relations to the security group being by internal ID in the database
          //   // instead of the string ID, anything depending on the old security group will be moved
          //   // to the new one on the second pass. However, there is a unique constraint on the
          //   // `GroupName`, so a temporary state with a random name may be necessary, so we
          //   // try-catch this call and mutate as necessary.
          //   try {
          //     return await AwsSecurityGroupModule.mappers.securityGroup.cloud.create(e, ctx);
          //   } catch (_) {
          //     // We mutate the `GroupName` to something unique and unlikely to collide (we should be
          //     // too slow to ever collide at a millisecond level). This path doesn't save back to
          //     // the DB like create does (at least right now, if that changes, we need to rethink
          //     // this logic here)
          //     e.groupName = Date.now().toString();
          //     return await AwsSecurityGroupModule.mappers.securityGroup.cloud.create(e, ctx);
          //   }
          // }));
          console.log('void');
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
              aws_repository: { repository_name: id }
            },
            relations: ["aws_repository"]
          } : undefined);
          return out;
        },
        update: async (e: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => { await ctx.orm.save(AwsRepositoryPolicy, e); },
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
          }
        },
        update: async (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => {
          await AwsEcrModule.mappers.securityGroupRule.cloud.create(rp, ctx);
        },
        delete: async (rp: AwsRepositoryPolicy | AwsRepositoryPolicy[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(rp) ? rp : [rp];
          await Promise.all(es.map(async (e) => {
            await client.deleteECRRepositoryPolicy(e.repository?.repositoryName!);
          }));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsEcr1636993401097.prototype.up,
    preremove: awsEcr1636993401097.prototype.down,
  },
});
