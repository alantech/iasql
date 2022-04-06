import { Role as AWSRole } from '@aws-sdk/client-iam'

import { Role } from './entity'
import { AWS, } from '../../services/gateways/aws'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import * as metadata from './module.json'

export const AwsIamModule: Module = new Module({
  ...metadata,
  utils: {
    roleMapper: (role: AWSRole, _ctx: Context) => {
      const out = new Role();
      out.arn = role.Arn;
      out.roleName = role.RoleName ?? '';
      out.description = role.Description ?? '';
      out.assumeRolePolicyDocument = decodeURIComponent(role.AssumeRolePolicyDocument ?? '');
      return out
    },
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
          return await Promise.all(es.map(async (role) => {
            const roleArn = await client.newRole(
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
            return role;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const roles = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getRole(id))) :
            (await client.getRoles()) ?? [];
          // TODO Ignore AWS service-linked roles for now
          // but add them back as special-cased roles or as a separate module
          // if there is a use case
          return await Promise.all(roles
            .filter(r => !r?.Path?.startsWith('/aws-service-role/'))
            .map(async (r) => {
              const role = AwsIamModule.utils.roleMapper(r, ctx);
              role.attachedPoliciesArns = await client.getRoleAttachedPoliciesArns(role.roleName);
              return role;
            })
          );
        },
        updateOrReplace: () => 'update',
        update: async (es: Role[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.Role?.[e.roleName ?? ''];
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
            return updatedRecord;
          }));
        },
        delete: async (es: Role[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const entity of es) {
            if (entity.arn) {
              await client.deleteRole(entity.roleName, entity.attachedPoliciesArns);
            }
          }
        },
      }),
    }),
  },
}, __dirname);