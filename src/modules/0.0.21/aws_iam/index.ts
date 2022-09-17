import isEqual from 'lodash.isequal';

import {
  IAM,
  ListAttachedRolePoliciesCommandInput,
  paginateListRoles,
  paginateListUsers,
  Role as AWSRole,
  User as AWSUser,
  waitUntilRoleExists
} from '@aws-sdk/client-iam';

import { policiesAreSame, objectsAreSame } from '../../../services/aws-diff';
import { AWS, crudBuilder2, crudBuilderFormat, mapLin, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';

import { Role, IamUser } from './entity';
import { createWaiter, WaiterState, WaiterOptions } from '@aws-sdk/util-waiter';

class UserMapper extends MapperBase<IamUser> {
  module: AwsIamModule;
  entity = IamUser;
  equals = (a: IamUser, b: IamUser) => {
    return (
      Object.is(a.arn, b.arn) &&
      Object.is(a.userId, b.userId) &&
      isEqual(a.createDate, b.createDate) &&
      Object.is(a.path, b.path)
    );
  };

  createNewUser = crudBuilderFormat<IAM, 'createUser', AWSUser | undefined>(
    'createUser',
    input => input,
    res => res?.User,
  );

  getUser = crudBuilderFormat<IAM, 'getUser', AWSUser | undefined>(
    'getUser',
    UserName => ({ UserName }),
    res => res?.User,
  );

  getAllUsers = paginateBuilder<IAM>(paginateListUsers, 'Users');

  updateUserPath = crudBuilder2<IAM, 'updateUser'>('updateUser', (UserName, NewPath) => ({
    UserName,
    NewPath,
  }));

  deleteUser = crudBuilder2<IAM, 'deleteUser'>('deleteUser', UserName => ({ UserName }));

  async userMapper(user: AWSUser, ctx: Context) {
    if (!user.UserName) return undefined;

    const out = new IamUser();
    out.arn = user.Arn;
    out.userName = user.UserName;
    out.userId = user.UserId;
    out.path = user.Path;
    if (user.CreateDate) out.createDate = user.CreateDate;
    return out;
  }

  cloud = new Crud2({
    create: async (es: IamUser[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const user of es) {
        const rawUser = await this.createNewUser(client.iamClient, {
          UserName: user.userName,
          Path: user.path,
        });
        if (rawUser) {
          const newUser = await this.userMapper(rawUser, ctx);
          if (newUser) {
            await this.module.user.db.update(newUser, ctx);
            out.push(newUser);
          }
        }
      }
      return out;
    },
    read: async (ctx: Context, userName?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (userName) {
        const rawUser = await this.getUser(client.iamClient, userName);
        if (!rawUser) return;

        const newUser = await this.userMapper(rawUser, ctx);
        return newUser;
      } else {
        const users = (await this.getAllUsers(client.iamClient)) ?? [];
        const out = [];
        for (const u of users) {
          const user = await this.userMapper(u, ctx);
          if (user) out.push(user);
        }
        return out;
      }
    },
    update: async (es: IamUser[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.IamUser?.[e.userName ?? ''];
        const isUpdate = this.module.user.cloud.updateOrReplace(cloudRecord, e) === 'update';

        if (isUpdate) {
          // if we have modified userId or arn or creation date, restore them
          if (e.arn !== cloudRecord.arn) e.arn = cloudRecord.arn;
          if (e.userId !== cloudRecord.userId) e.userId = cloudRecord.userId;
          if (e.createDate !== cloudRecord.createDate) e.createDate = cloudRecord.createDate;

          // if we have modified path, update in cloud
          if (e.path !== cloudRecord.path) await this.updateUserPath(client.iamClient, e.userName, e.path);

          const result = await this.module.user.db.update(e, ctx);
          if (!result) continue;
          out.push(e);
        }
      }
      return out;
    },
    delete: async (es: IamUser[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of es) {
        if (e.userName) {
          await this.deleteUser(client.iamClient, e.userName);
        }
      }
    },
  });

  constructor(module: AwsIamModule) {
    super();
    this.module = module;
    super.init();
  }
}

class RoleMapper extends MapperBase<Role> {
  module: AwsIamModule;
  entity = Role;
  equals = (a: Role, b: Role) =>
    Object.is(a.roleName, b.roleName) &&
    Object.is(a.arn, b.arn) &&
    Object.is(a.description, b.description) &&
    policiesAreSame(a.assumeRolePolicyDocument, b.assumeRolePolicyDocument) &&
    objectsAreSame(a.attachedPoliciesArns, b.attachedPoliciesArns);

  getRoleAttachedPoliciesArns = crudBuilderFormat<IAM, 'listAttachedRolePolicies', string[] | undefined>(
    'listAttachedRolePolicies',
    RoleName => ({ RoleName }),
    res => (res?.AttachedPolicies?.length ? res.AttachedPolicies.map(p => p.PolicyArn ?? '') : undefined),
  );

  createNewRole = crudBuilderFormat<IAM, 'createRole', string>(
    'createRole',
    input => input,
    res => res?.Role?.Arn ?? '',
  );

  attachRolePolicy = crudBuilder2<IAM, 'attachRolePolicy'>('attachRolePolicy', (RoleName, PolicyArn) => ({
    RoleName,
    PolicyArn,
  }));

  attachRolePolicies = (client: IAM, roleName: string, policyArns: string[]) =>
    mapLin(policyArns, policyArn => this.attachRolePolicy(client, roleName, policyArn));

  createInstanceProfile = crudBuilder2<IAM, 'createInstanceProfile'>(
    'createInstanceProfile',
    InstanceProfileName => ({
      InstanceProfileName,
    }),
  );

  attachRoleToInstanceProfile = crudBuilder2<IAM, 'addRoleToInstanceProfile'>(
    'addRoleToInstanceProfile',
    RoleName => ({
      InstanceProfileName: RoleName,
      RoleName,
    }),
  );

  deleteInstanceProfile = crudBuilder2<IAM, 'deleteInstanceProfile'>(
    'deleteInstanceProfile',
    InstanceProfileName => ({
      InstanceProfileName,
    }),
  );

  detachRoleToInstanceProfile = crudBuilder2<IAM, 'removeRoleFromInstanceProfile'>(
    'removeRoleFromInstanceProfile',
    RoleName => ({
      InstanceProfileName: RoleName,
      RoleName,
    }),
  );

  getRole = crudBuilderFormat<IAM, 'getRole', AWSRole | undefined>(
    'getRole',
    RoleName => ({ RoleName }),
    res => res?.Role,
  );

  getAllRoles = paginateBuilder<IAM>(paginateListRoles, 'Roles');

  updateRoleAssumePolicy = crudBuilder2<IAM, 'updateAssumeRolePolicy'>(
    'updateAssumeRolePolicy',
    (RoleName, PolicyDocument) => ({
      RoleName,
      PolicyDocument,
    }),
  );

  updateRoleDescription = crudBuilder2<IAM, 'updateRole'>('updateRole', (RoleName, Description?) => ({
    RoleName,
    Description,
  }));

  detachRolePolicy = crudBuilder2<IAM, 'detachRolePolicy'>('detachRolePolicy', (RoleName, PolicyArn) => ({
    RoleName,
    PolicyArn,
  }));

  detachRolePolicies = (client: IAM, roleName: string, policyArns: string[]) =>
    mapLin(policyArns, (policyArn: string) => this.detachRolePolicy(client, roleName, policyArn));

  deleteRole = crudBuilder2<IAM, 'deleteRole'>('deleteRole', RoleName => ({ RoleName }));

  async waitForAttachedRolePolicies(client: IAM, roleName: string, policyArns: string[]) {
    // wait for policies to be attached
    const input: ListAttachedRolePoliciesCommandInput = {
      RoleName: roleName,
    }
    await createWaiter<IAM, ListAttachedRolePoliciesCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 900,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (cl, cmd) => {
        try {
          const data = await cl.listAttachedRolePolicies(cmd);
          const arns = data?.AttachedPolicies?.map(ap => ap.PolicyArn);
          if (!objectsAreSame(arns, policyArns)) {
            return { state: WaiterState.RETRY };
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      },
    );
  }

  async roleMapper(role: AWSRole, ctx: Context) {
    const client = (await ctx.getAwsClient()) as AWS;
    const out = new Role();
    out.arn = role.Arn;
    if (!role.RoleName) return undefined;
    out.roleName = role.RoleName;
    out.description = role.Description;
    try {
      out.attachedPoliciesArns = await this.getRoleAttachedPoliciesArns(client.iamClient, role.RoleName);
    } catch (e: any) {
      // If could not get policies for the role implies a misconfiguration
      if (e.Code === 'NoSuchEntity') return undefined;
    }
    if (!role.AssumeRolePolicyDocument) return undefined;
    try {
      out.assumeRolePolicyDocument = JSON.parse(decodeURIComponent(role.AssumeRolePolicyDocument));
    } catch (_) {
      // Without policy the role is misconfigured
      return undefined;
    }
    return out;
  }
  roleNameFromArn(arn: string, _ctx: Context) {
    // Role name is always the last element
    // Regular role example - arn:aws:iam::547931376551:role/AWSECSTaskExecution
    // AWS service role example -
    //   arn:aws:iam::547931376551:role/aws-service-role/ecs.amazonaws.com/AWSServiceRoleForECS
    // EC2 role instance profile ARN example - arn:aws:iam::257682470237:instance-profile/test-role
    return arn.split('/').pop();
  }
  allowEc2Service(a: Role) {
    return a.assumeRolePolicyDocument?.Statement?.find(
      (s: any) => s.Effect === 'Allow' && s.Principal?.Service === 'ec2.amazonaws.com',
    );
  }

  cloud = new Crud2({
    create: async (es: Role[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const role of es) {
        const roleArn = await this.createNewRole(client.iamClient, {
          RoleName: role.roleName,
          AssumeRolePolicyDocument: JSON.stringify(role.assumeRolePolicyDocument),
          Description: role.description,
          
        });
        if (!roleArn) {
          // then who?
          throw new Error('should not be possible');
        }
        await waitUntilRoleExists(
          {
            client: client.iamClient,
            // all in seconds
            maxWaitTime: 900,
            minDelay: 1,
            maxDelay: 4,
          } as WaiterOptions<IAM>,
          { RoleName: role.roleName },
        );
        await this.attachRolePolicies(client.iamClient, role.roleName, role.attachedPoliciesArns ?? []);
        await this.waitForAttachedRolePolicies(client.iamClient, role.roleName, role.attachedPoliciesArns ?? []);
        const allowEc2Service = this.allowEc2Service(role);
        if (allowEc2Service) {
          await this.createInstanceProfile(client.iamClient, role.roleName);
          await this.attachRoleToInstanceProfile(client.iamClient, role.roleName);
        }
        const rawRole = await this.getRole(client.iamClient, role.roleName);
        if (!rawRole) continue;
        const newRole = await this.roleMapper(rawRole, ctx);
        if (!newRole) continue;
        await this.module.role.db.update(newRole, ctx);
        out.push(newRole);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawRole = await this.getRole(client.iamClient, id);
        if (!rawRole) return;
        const role = await this.roleMapper(rawRole, ctx);
        return role;
      } else {
        const roles = (await this.getAllRoles(client.iamClient)) ?? [];
        const out = [];
        for (const r of roles) {
          const role = await this.roleMapper(r, ctx);
          if (role) out.push(role);
        }
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: Role[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.Role?.[e.roleName ?? ''];
        // aws-service-roles are immutable so undo change and return
        if (cloudRecord.arn.includes(':role/aws-service-role/')) {
          await this.module.role.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
          continue;
        }
        const b = cloudRecord;
        let update = false;
        let updatedRecord = { ...cloudRecord };
        if (!policiesAreSame(e.assumeRolePolicyDocument, b.assumeRolePolicyDocument)) {
          await this.updateRoleAssumePolicy(
            client.iamClient,
            e.roleName,
            JSON.stringify(e.assumeRolePolicyDocument),
          );
          const eAllowEc2Service = this.allowEc2Service(e);
          const cloudRecordAllowEc2Service = this.allowEc2Service(cloudRecord);
          if (eAllowEc2Service && !cloudRecordAllowEc2Service) {
            await this.createInstanceProfile(client.iamClient, e.roleName);
            await this.attachRoleToInstanceProfile(client.iamClient, e.roleName);
          } else if (cloudRecordAllowEc2Service && !eAllowEc2Service) {
            await this.detachRoleToInstanceProfile(client.iamClient, e.roleName);
            await this.deleteInstanceProfile(client.iamClient, e.roleName);
          }
          update = true;
        }
        if (!objectsAreSame(e.attachedPoliciesArns, b.attachedPoliciesArns)) {
          await this.detachRolePolicies(
            client.iamClient,
            e.roleName,
            b.attachedPoliciesArns ?? [],
          );
          await this.attachRolePolicies(
            client.iamClient,
            e.roleName,
            e.attachedPoliciesArns ?? [],
          );
          await this.waitForAttachedRolePolicies(client.iamClient, e.roleName, e.attachedPoliciesArns ?? []);
          update = true;
        }
        if (!Object.is(e.description, b.description)) {
          await this.updateRoleDescription(client.iamClient, e.roleName, e.description);
          update = true;
        }
        if (update) {
          const dbRole = await this.getRole(client.iamClient, e.roleName);
          if (!dbRole) continue;
          updatedRecord = await this.roleMapper(dbRole, ctx);
        }
        await this.module.role.db.update(updatedRecord, ctx);
        out.push(updatedRecord);
      }
      return out;
    },
    delete: async (es: Role[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const entity of es) {
        if (entity.arn) {
          // aws-service-roles cannot be deleted so restore it in the db
          if (entity.arn.includes(':role/aws-service-role/')) {
            await this.module.role.db.create(entity, ctx);
          } else {
            const allowEc2Service = this.allowEc2Service(entity);
            if (allowEc2Service) {
              try {
                await this.detachRoleToInstanceProfile(client.iamClient, entity.roleName);
                await this.deleteInstanceProfile(client.iamClient, entity.roleName);
              } catch (e: any) {
                // If role not found do nothing.
                if (e.Code !== 'NoSuchEntity') throw e;
              }
            }
            await this.detachRolePolicies(
              client.iamClient,
              entity.roleName,
              entity.attachedPoliciesArns ?? [],
            );
            await this.deleteRole(client.iamClient, entity.roleName);
          }
        }
      }
    },
  });

  constructor(module: AwsIamModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsIamModule extends ModuleBase {
  role: RoleMapper;
  user: UserMapper;

  constructor() {
    super();
    this.role = new RoleMapper(this);
    this.user = new UserMapper(this);
    super.init();
  }
}
export const awsIamModule = new AwsIamModule();