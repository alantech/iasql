import {
  CreateRoleCommandInput,
  GetRoleCommandOutput,
  IAM,
  ListAttachedRolePoliciesCommandOutput,
  paginateListRoles,
  Role as AWSRole
} from '@aws-sdk/client-iam'

import { Role } from './entity'
import { AWS, crudBuilder, mapLin, paginateBuilder, } from '../../../services/aws_macros'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import * as metadata from './module.json'

const getRoleAttachedPoliciesArns = crudBuilder<IAM>(
  'listAttachedRolePolicies',
  (roleName: string) => ({ RoleName: roleName, }),
  (res: ListAttachedRolePoliciesCommandOutput) => res.AttachedPolicies?.length ? res.AttachedPolicies.map(p => p.PolicyArn ?? '') : undefined,
);

// TODO: How to macro-ify this passing the attachedPolicyArns as argument for the return formatter?
async function createNewRole(client: IAM, input: CreateRoleCommandInput, attachedPolicyArns: string[]): Promise<string> {
  const role = await client.createRole(input);
  for (const arn of attachedPolicyArns) {
    await client.attachRolePolicy({PolicyArn: arn, RoleName: input.RoleName});
  }
  return role.Role?.Arn ?? '';
}

const createInstanceProfile = crudBuilder<IAM>(
  'createInstanceProfile',
  (roleName: string) => ({ InstanceProfileName: roleName, }),
);

const attachRoleToInstanceProfile = crudBuilder<IAM>(
  'addRoleToInstanceProfile',
  (roleName: string) => ({
    InstanceProfileName: roleName,
    RoleName: roleName,
  }),
);

const deleteInstanceProfile = crudBuilder<IAM>(
  'deleteInstanceProfile',
  (roleName: string) => ({ InstanceProfileName: roleName, }),
);

const detachRoleToInstanceProfile = crudBuilder<IAM>(
  'removeRoleFromInstanceProfile',
  (roleName: string) => ({
    InstanceProfileName: roleName,
    RoleName: roleName,
  }),
);

const getRole = crudBuilder<IAM>(
  'getRole',
  (roleName: string) => ({ RoleName: roleName, }),
  (res: GetRoleCommandOutput) => res.Role,
);

const getAllRoles = paginateBuilder<IAM>(
  paginateListRoles,
  'Roles',
);


const updateRoleAssumePolicy = crudBuilder<IAM>(
  'updateAssumeRolePolicy',
  (roleName: string, assumeRolePolicyDocument: string) => ({
    RoleName: roleName,
    PolicyDocument: assumeRolePolicyDocument,
  }),
);

const updateRoleDescription = crudBuilder<IAM>(
  'updateRole',
  (roleName: string, description?: string) => ({
    RoleName: roleName,
    Description: description
  }),
);

const detachRolePolicy = crudBuilder<IAM>(
  'detachRolePolicy',
  (roleName: string, policyArn: string) => ({ RoleName: roleName, PolicyArn: policyArn, }),
);
const detachRolePolicies = (client: IAM, roleName: string, policyArns: string[]) => mapLin(
  Promise.resolve(policyArns),
  (policyArn: string) => detachRolePolicy(client, roleName, policyArn)
);

const deleteRole = crudBuilder<IAM>(
  'deleteRole',
  (roleName: string) => ({ RoleName: roleName, }),
);

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
      out.attachedPoliciesArns = await getRoleAttachedPoliciesArns(client.iamClient, role.RoleName);
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
            const roleArn = await createNewRole(
              client.iamClient,
              {
                RoleName: role.roleName,
                AssumeRolePolicyDocument: JSON.stringify(role.assumeRolePolicyDocument),
                Description: role.description,
              },
              role.attachedPoliciesArns ?? [],
            );
            if (!roleArn) { // then who?
              throw new Error('should not be possible');
            }
            const allowEc2Service = AwsIamModule.utils.allowEc2Service(role);
            if (allowEc2Service) {
              await createInstanceProfile(client.iamClient, role.roleName);
              await attachRoleToInstanceProfile(client.iamClient, role.roleName);
            }
            const rawRole = await getRole(client.iamClient, role.roleName);
            const newRole = await AwsIamModule.utils.roleMapper(rawRole, ctx);
            await AwsIamModule.mappers.role.db.update(newRole, ctx);
            out.push(newRole);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawRole = await getRole(client.iamClient, id);
            if (!rawRole) return;
            const role = await AwsIamModule.utils.roleMapper(rawRole, ctx);
            return role;
          } else {
            const roles = (await getAllRoles(client.iamClient)) ?? [];
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
              await updateRoleAssumePolicy(client.iamClient, e.roleName, JSON.stringify(e.assumeRolePolicyDocument));
              const eAllowEc2Service = AwsIamModule.utils.allowEc2Service(e);
              const cloudRecordAllowEc2Service = AwsIamModule.utils.allowEc2Service(cloudRecord);
              if (eAllowEc2Service && !cloudRecordAllowEc2Service) {
                await createInstanceProfile(client.iamClient, e.roleName);
                await attachRoleToInstanceProfile(client.iamClient, e.roleName);
              } else if (cloudRecordAllowEc2Service && !eAllowEc2Service) {
                await detachRoleToInstanceProfile(client.iamClient, e.roleName);
                await deleteInstanceProfile(client.iamClient, e.roleName);
              }
              update = true;
            }
            if (!Object.is(e.description, b.description)) {
              await updateRoleDescription(client.iamClient, e.roleName, e.description);
              update = true;
            }
            if (update) {
              const dbRole = await getRole(client.iamClient, e.roleName);
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
                  await detachRoleToInstanceProfile(client.iamClient, entity.roleName);
                  await deleteInstanceProfile(client.iamClient, entity.roleName);
                }
                await detachRolePolicies(client.iamClient, entity.roleName, entity.attachedPoliciesArns ?? []);
                await deleteRole(client.iamClient, entity.roleName);
              }
            }
          }
        },
      }),
    }),
  },
}, __dirname);