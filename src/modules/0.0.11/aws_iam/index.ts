import { Role as AWSRole } from '@aws-sdk/client-iam'

import { Role } from './entity'
import { AWS, } from '../../../services/gateways/aws_2'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import * as metadata from './module.json'
import logger from '../../../services/logger'

export const AwsIamModule: Module2 = new Module2({
  ...metadata,
  utils: {
    roleMapper: async (role: AWSRole, ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = new Role();
      out.arn = role.Arn;
      if (!role.RoleName) return undefined;
      out.roleName = role.RoleName;
      out.description = role.Description;
      out.attachedPoliciesArns = await client.getRoleAttachedPoliciesArnsV2(out.roleName);
      if (!role.AssumeRolePolicyDocument) return undefined;
      try {
        out.assumeRolePolicyDocument = JSON.parse(decodeURIComponent(role.AssumeRolePolicyDocument));
      } catch (_) {
        // Without policy the role is misconfigured
        return undefined;
      }
      return out;
    },
    roleNameFromArn: (arn: string, _ctx: Context) => {
      // Role name is always the last element
      // Regular role example - arn:aws:iam::547931376551:role/AWSECSTaskExecution
      // AWS service role example - arn:aws:iam::547931376551:role/aws-service-role/ecs.amazonaws.com/AWSServiceRoleForECS
      // EC2 role instance profile ARN example - arn:aws:iam::257682470237:instance-profile/test-role
      return  arn.split('/').pop();
    },
    rolePolicyComparison: (a: any, b: any) => {
      return Object.is(Object.keys(a).length, Object.keys(b).length)
      && Object.is(a.Statement?.length, b.Statement?.length)
      && a.Statement.every((as: any) => !!b.Statement.find((
        bs: any) => Object.is(as.Effect, bs.Effect) && Object.is(as.Action, bs.Action) &&
        Object.is(JSON.stringify(as.Principal), JSON.stringify(bs.Principal))))
    },
    allowEc2Service: (a: Role) => {
      return a.assumeRolePolicyDocument?.Statement?.find(
        (s: any) => s.Effect === 'Allow' && s.Principal?.Service === 'ec2.amazonaws.com');
    },
  },
  mappers: {
    role: new Mapper2<Role>({
      entity: Role,
      equals: (a: Role, b: Role) => Object.is(a.roleName, b.roleName) &&
        Object.is(a.arn, b.arn) &&
        Object.is(a.description, b.description) &&
        AwsIamModule.utils.rolePolicyComparison(a.assumeRolePolicyDocument, b.assumeRolePolicyDocument) &&
        Object.is(a.attachedPoliciesArns?.length, b.attachedPoliciesArns?.length) &&
        ((!a.attachedPoliciesArns && !b.attachedPoliciesArns) || !!a.attachedPoliciesArns?.every(as => !!b.attachedPoliciesArns?.find(bs => Object.is(as, bs)))),
      source: 'db',
      cloud: new Crud2({
        create: async (es: Role[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const role of es) {
            const roleArn = await client.newRoleLin(
              role.roleName,
              JSON.stringify(role.assumeRolePolicyDocument),
              role.attachedPoliciesArns ?? [],
              role.description
            );
            if (!roleArn) { // then who?
              throw new Error('should not be possible');
            }
            const allowEc2Service = AwsIamModule.utils.allowEc2Service(role);
            if (allowEc2Service) {
              await client.createInstanceProfile(role.roleName);
              await client.attachRoleToInstanceProfile(role.roleName);
            }
            const rawRole = await client.getRole(role.roleName);
            const newRole = await AwsIamModule.utils.roleMapper(rawRole, ctx);
            await AwsIamModule.mappers.role.db.update(newRole, ctx);
            out.push(newRole);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawRole = await client.getRole(id);
            if (!rawRole) return;
            const role = await AwsIamModule.utils.roleMapper(rawRole, ctx);
            return role;
          } else {
            const roles = (await client.getAllRoles()) ?? [];
            const out = [];
            for (const r of roles) {
              const role = await AwsIamModule.utils.roleMapper(r, ctx);
              out.push(role);
            }
            return out;
          }
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
            if (!AwsIamModule.utils.rolePolicyComparison(e.assumeRolePolicyDocument, b.assumeRolePolicyDocument)) {
              await client.updateRoleAssumePolicy(e.roleName, JSON.stringify(e.assumeRolePolicyDocument));
              const eAllowEc2Service = AwsIamModule.utils.allowEc2Service(e);
              const cloudRecordAllowEc2Service = AwsIamModule.utils.allowEc2Service(cloudRecord);
              if (eAllowEc2Service && !cloudRecordAllowEc2Service) {
                await client.createInstanceProfile(e.roleName);
                await client.attachRoleToInstanceProfile(e.roleName);
              } else if (cloudRecordAllowEc2Service && !eAllowEc2Service) {
                await client.detachRoleToInstanceProfile(e.roleName);
                await client.deleteInstanceProfile(e.roleName);
              }
              update = true;
            }
            if (!Object.is(e.description, b.description)) {
              await client.updateRoleDescription(e.roleName, e.description);
              update = true;
            }
            if (update) {
              const dbRole = await client.getRole(e.roleName);
              updatedRecord = await AwsIamModule.utils.roleMapper(dbRole, ctx);
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
                const allowEc2Service = AwsIamModule.utils.allowEc2Service(entity);
                if (allowEc2Service) {
                  await client.detachRoleToInstanceProfile(entity.roleName);
                  await client.deleteInstanceProfile(entity.roleName);
                }
                await client.deleteRoleLin(entity.roleName, entity.attachedPoliciesArns ?? []);
              }
            }
          }
        },
      }),
    }),
  },
}, __dirname);