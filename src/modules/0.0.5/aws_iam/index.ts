import { Role as AWSRole } from '@aws-sdk/client-iam'

import { Role } from './entity'
import { AWS, } from '../../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../../interfaces'
import * as metadata from './module.json'

export const AwsIamModule: Module = new Module({
  ...metadata,
  utils: {
    roleMapper: (role: AWSRole) => {
      const out = new Role();
      out.arn = role.Arn;
      out.roleName = role.RoleName ?? '';
      out.description = role.Description ?? '';
      out.assumeRolePolicyDocument = decodeURIComponent(role.AssumeRolePolicyDocument ?? '');
      return out;
    },
    roleNameFromArn: (arn: string, _ctx: Context) => {
      const roleName = arn.split(':role/')[1];
      // Regular role example - arn:aws:iam::547931376551:role/AWSECSTaskExecution
      // AWS service role example - arn:aws:iam::547931376551:role/aws-service-role/ecs.amazonaws.com/AWSServiceRoleForECS
      return roleName.split('/').length === 3 ? roleName.split('/')[2] : roleName;
    }
  },
  mappers: {
    role: new Mapper<Role>({
      entity: Role,
      equals: (a: Role, b: Role) => Object.is(a.roleName, b.roleName) &&
        Object.is(a.arn, b.arn) &&
        Object.is(a.description, b.description) &&
        // the policy document is stringified json
        // we are trusting aws won't change it from under us
        Object.is(a.assumeRolePolicyDocument, b.assumeRolePolicyDocument) &&
        Object.is(a.attachedPoliciesArns?.length, b.attachedPoliciesArns?.length) &&
        a.attachedPoliciesArns?.every(as => !!b.attachedPoliciesArns?.find(bs => Object.is(as, bs))),
      source: 'db',
      cloud: new Crud({
        create: async (es: Role[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const role of es) {
            const roleArn = await client.newRoleLin(
              role.roleName,
              role.assumeRolePolicyDocument,
              role.attachedPoliciesArns,
              role.description ?? ''
            );
            if (!roleArn) { // then who?
              throw new Error('should not be possible');
            }
            role.arn = roleArn;
            await AwsIamModule.mappers.role.db.update(role, ctx);
            out.push(role);
          }
          return out;
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const roles = Array.isArray(ids) ? await (async () => {
            const o = [];
            for (const id of ids) {
              o.push(await client.getRole(id));
            }
            return o;
          })() :
            (await client.getAllRoles()) ?? [];
          const out = [];
          for (const r of roles) {
            const role = AwsIamModule.utils.roleMapper(r);
            role.attachedPoliciesArns = await client.getRoleAttachedPoliciesArns(role.roleName);
            out.push(role);
          }
          return out;
        },
        updateOrReplace: () => 'update',
        update: async (es: Role[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.Role?.[e.roleName ?? ''];
            // aws-service-roles are immutable so undo change and return
            if (cloudRecord.arn.includes(':role/aws-service-role/')) {
              await AwsIamModule.mappers.role.db.update(cloudRecord, ctx);
              out.push(cloudRecord);
              continue;
            }
            const b = cloudRecord;
            let update = false;
            let updatedRecord = { ...cloudRecord };
            if (!Object.is(e.assumeRolePolicyDocument, b.assumeRolePolicyDocument)) {
              await client.updateRoleAssumePolicy(e.roleName, e.assumeRolePolicyDocument);
              update = true;
            }
            if (!Object.is(e.description, b.description)) {
              await client.updateRoleDescription(e.roleName, e.description ?? '');
              update = true;
            }
            if (update) {
              const dbRole = await client.getRole(e.roleName);
              updatedRecord = await AwsIamModule.utils.roleMapper(dbRole, ctx);
              updatedRecord.attachedPoliciesArns = await client.getRoleAttachedPoliciesArns(updatedRecord.roleName);
            }
            await AwsIamModule.mappers.role.db.update(updatedRecord, ctx);
            out.push(updatedRecord);
          }
          return out;
        },
        delete: async (es: Role[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const entity of es) {
            if (entity.arn) {
              // aws-service-roles cannot be deleted so restore it in the db
              if (entity.arn.includes(':role/aws-service-role/')) {
                await AwsIamModule.mappers.role.db.create(entity, ctx);
              } else {
                await client.deleteRoleLin(entity.roleName, entity.attachedPoliciesArns);
              }
            }
          }
        },
      }),
    }),
  },
}, __dirname);