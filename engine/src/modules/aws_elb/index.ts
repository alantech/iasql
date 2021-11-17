import { In, } from 'typeorm'
import { Action, } from '@aws-sdk/client-elastic-load-balancing-v2'

import { AWS, } from '../../services/gateways/aws'
import { ActionTypeEnum, AwsAction, } from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsElb1637092695969, } from './migration/1637092695969-aws_elb'

export const AwsElbModule: Module = new Module({
  name: 'aws_elb',
  dependencies: ['aws_account', 'aws_security_group'],
  provides: {
    tables: ['aws_action',],
    // functions: ['create_ecr_repository', 'create_ecr_repository_policy'],
  },
  utils: {
    actionMapper: async (a: Action, ctx: Context) => {
      const out = new AwsAction();
      if (!a?.Type || !a?.TargetGroupArn) {
        throw new Error('Listerner action not defined properly');
      }
      out.actionType = (a.Type as ActionTypeEnum);
      out.targetGroup = await AwsElbModule.mappers.targetGroup.cloud.read(ctx, a.TargetGroupArn);
      return out;
    },
    // repositoryPolicyMapper: async (rp: any, ctx: Context) => {
    //   const out = new AwsActionPolicy();
    //   out.registryId = rp?.registryId;
    //   out.repository = ctx.memo?.db?.AwsAction?.rp?.repositoryName ?? await AwsEcrModule.mappers.repository.cloud.read(ctx, rp?.repositoryName);
    //   out.policyText = rp?.policyText ?? false;
    //   return out;
    // },
  },
  mappers: {
    action: new Mapper<AwsAction>({
      entity: AwsAction,
      entityId: (e: AwsAction) => e?.targetGroup?.targetGroupArn ?? '',
      equals: (_a: AwsAction, _b: AwsAction) => true, // Do not update actions
      source: 'db',
      db: new Crud({
        create: async (e: AwsAction | AwsAction[], ctx: Context) => { await ctx.orm.save(AwsAction, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const a = await ctx.orm.find(AwsAction, id ? {
            where: {
              targetGroup: { targetGroupArn: Array.isArray(id) ? In(id) : id },
            },
            relations: ['targetGroup'],
          } : { relations: ['targetGroup'], });
          return a;
        },
        update: async (e: AwsAction | AwsAction[], ctx: Context) => { await ctx.orm.save(AwsAction, e); },
        delete: async (e: AwsAction | AwsAction[], ctx: Context) => { await ctx.orm.remove(AwsAction, e);},
      }),
      cloud: new Crud({
        create: (_a: AwsAction | AwsAction[], _ctx: Context) => {
          throw new Error('tbd');
        },
        read: (_ctx: Context, _ids?: string | string[]) => {
          throw new Error('tbd');
        },
        update: (_a: AwsAction | AwsAction[], _ctx: Context) => {
          throw new Error('tbd');
        },
        delete: (_a: AwsAction | AwsAction[], _ctx: Context) => {
          throw new Error('tbd');
        },
      }),
    }),
    // repositoryPolicy: new Mapper<AwsActionPolicy>({
    //   entity: AwsActionPolicy,
    //   entityId: (e: AwsActionPolicy) => e.repository?.repositoryName + '',
    //   equals: (a: AwsActionPolicy, b: AwsActionPolicy) => Object.is(a.policyText, b.policyText),
    //   source: 'db',
    //   db: new Crud({
    //     create: async (e: AwsActionPolicy | AwsActionPolicy[], ctx: Context) => { await ctx.orm.save(AwsActionPolicy, e); },
    //     read: async (ctx: Context, id?: string | string[] | undefined) => {
    //       const out = await ctx.orm.find(AwsActionPolicy, id ? {
    //         where: {
    //           repository: { repositoryName: id }
    //         },
    //         relations: ["repository"]
    //       } : { relations: ["repository"] });
    //       return out;
    //     },
    //     update: async (rp: AwsActionPolicy | AwsActionPolicy[], ctx: Context) => {
    //       const es = Array.isArray(rp) ? rp : [rp];
    //       for (const e of es) {
    //         if (!e.repository.id) {
    //           const r = await AwsEcrModule.mappers.repository.db.read(ctx, e.repository.repositoryName);
    //           e.repository = r;
    //         }
    //       }
    //       await ctx.orm.save(AwsActionPolicy, es);
    //     },
    //     delete: async (e: AwsActionPolicy | AwsActionPolicy[], ctx: Context) => { await ctx.orm.remove(AwsActionPolicy, e); },
    //   }),
    //   cloud: new Crud({
    //     create: async (rp: AwsActionPolicy | AwsActionPolicy[], ctx: Context) => {
    //       const client = await ctx.getAwsClient() as AWS;
    //       const es = Array.isArray(rp) ? rp : [rp];
    //       const out = await Promise.all(es.map(async (e) => {
    //         const result = await client.setECRRepositoryPolicy({
    //           repositoryName: e.repository.repositoryName,
    //           policyText: e.policyText,
    //         });
    //         // TODO: Handle if it fails (somehow)
    //         if (!result.hasOwnProperty('repositoryName')) { // Failure
    //           throw new Error('what should we do here?');
    //         }
    //         // Re-get the inserted record to get all of the relevant records we care about
    //         const newObject = await client.getECRRepositoryPolicy(result.repositoryName ?? '');
    //         // We map this into the same kind of entity as `obj`
    //         const newEntity = await AwsEcrModule.utils.repositoryPolicyMapper(newObject, ctx);
    //         // We attach the original object's ID to this new one, indicating the exact record it is
    //         // replacing in the database.
    //         newEntity.id = e.id;
    //         // Save the record back into the database to get the new fields updated
    //         await AwsEcrModule.mappers.repositoryPolicy.db.update(newEntity, ctx);
    //         return newEntity;
    //       }));
    //       // Make sure the dimensionality of the returned data matches the input
    //       if (Array.isArray(rp)) {
    //         return out;
    //       } else {
    //         return out[0];
    //       }
    //     },
    //     read: async (ctx: Context, ids?: string | string[]) => {
    //       const client = await ctx.getAwsClient() as AWS;
    //       if (ids) {
    //         if (Array.isArray(ids)) {
    //           return await Promise.all(ids.map(async (id) => {
    //             return await AwsEcrModule.utils.repositoryPolicyMapper(
    //               await client.getECRRepositoryPolicy(id), ctx
    //             );
    //           }));
    //         } else {
    //           return await AwsEcrModule.utils.repositoryPolicyMapper(
    //             await client.getECRRepositoryPolicy(ids), ctx
    //           );
    //         }
    //       } else {
    //         const repositories = ctx.memo?.cloud?.AwsAction ? Object.values(ctx.memo?.cloud?.AwsAction) : await AwsEcrModule.mappers.repository.cloud.read(ctx);
    //         const policies: any = [];
    //         for (const r of repositories) {
    //           try {
    //             const rp = await client.getECRRepositoryPolicy(r.repositoryName);
    //             policies.push(rp);
    //           } catch (_) {
    //             // We try to retrieve the policy for the repository, but if none it is not an error
    //             continue;
    //           }
    //         }
    //         return await Promise.all(policies.map(async (rp: any) => {
    //           return await AwsEcrModule.utils.repositoryPolicyMapper(rp, ctx);
    //         }));
    //       }
    //     },
    //     update: async (rp: AwsActionPolicy | AwsActionPolicy[], ctx: Context) => {
    //       await AwsEcrModule.mappers.repositoryPolicy.cloud.create(rp, ctx);
    //     },
    //     delete: async (rp: AwsActionPolicy | AwsActionPolicy[], ctx: Context) => {
    //       const client = await ctx.getAwsClient() as AWS;
    //       const es = Array.isArray(rp) ? rp : [rp];
    //       await Promise.all(es.map(async (e) => {
    //         try {
    //           await client.deleteECRRepositoryPolicy(e.repository.repositoryName!);
    //         } catch (e: any) {
    //           // Do nothing if repository not found. It means the repository got deleted first and the policy has already been removed
    //           if (e.name !== 'RepositoryNotFoundException') {
    //             throw e;
    //           }
    //         }
    //       }));
    //     },
    //   }),
    // }),
  },
  migrations: {
    postinstall: awsElb1637092695969.prototype.up,
    preremove: awsElb1637092695969.prototype.down,
  },
});
