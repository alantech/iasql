import {
  IAM,
  ListAttachedRolePoliciesCommandInput,
  paginateListRoles,
  Role as AWSRole,
  waitUntilRoleExists,
} from '@aws-sdk/client-iam';
import { createWaiter, WaiterOptions, WaiterState } from '@aws-sdk/util-waiter';

import { AwsIamModule } from '..';
import { objectsAreSame, policiesAreSame } from '../../../services/aws-diff';
import { AWS, crudBuilder2, crudBuilderFormat, mapLin, paginateBuilder } from '../../../services/aws_macros';
import { CanonicalStatement, normalizePolicy } from '../../../services/canonical-iam-policy';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { IamRole } from '../entity';

export class RoleMapper extends MapperBase<IamRole> {
  module: AwsIamModule;
  entity = IamRole;
  equals = (a: IamRole, b: IamRole) =>
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
    };
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
    const out = new IamRole();
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

  allowEc2Service(a: IamRole) {
    if (a.assumeRolePolicyDocument)
      return normalizePolicy(a.assumeRolePolicyDocument).Statement.find(
        (s: CanonicalStatement) =>
          s.Effect === 'Allow' && s.Principal?.Service?.includes('ec2.amazonaws.com'),
      );
    return false;
  }

  cloud = new Crud2({
    create: async (es: IamRole[], ctx: Context) => {
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
        await this.waitForAttachedRolePolicies(
          client.iamClient,
          role.roleName,
          role.attachedPoliciesArns ?? [],
        );
        const allowEc2Service = this.allowEc2Service(role);
        if (allowEc2Service) {
          await this.createInstanceProfile(client.iamClient, role.roleName);
          await this.attachRoleToInstanceProfile(client.iamClient, role.roleName);
        }
        const rawRole = await this.getRole(client.iamClient, role.roleName);
        if (!rawRole) continue;
        const newRole = await this.roleMapper(rawRole, ctx);
        if (!newRole) continue;
        if (await this.module.role.db.read(ctx, role.roleName))
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
    update: async (es: IamRole[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.IamRole?.[e.roleName ?? ''];
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
          await this.detachRolePolicies(client.iamClient, e.roleName, b.attachedPoliciesArns ?? []);
          await this.attachRolePolicies(client.iamClient, e.roleName, e.attachedPoliciesArns ?? []);
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
    delete: async (es: IamRole[], ctx: Context) => {
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
            await this.waitForAttachedRolePolicies(client.iamClient, entity.roleName, []);
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
