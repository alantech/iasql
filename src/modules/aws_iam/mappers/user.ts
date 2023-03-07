import isEqual from 'lodash.isequal';

import {
  IAM,
  ListAttachedUserPoliciesCommandInput,
  LoginProfile,
  NoSuchEntityException,
  paginateListAccessKeys,
  paginateListUsers,
  User as AWSUser,
  waitUntilUserExists,
} from '@aws-sdk/client-iam';
import { createWaiter, WaiterOptions, WaiterState } from '@aws-sdk/util-waiter';

import { AwsIamModule } from '..';
import { objectsAreSame } from '../../../services/aws-diff';
import { AWS, crudBuilder, crudBuilderFormat, mapLin, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { IamUser } from '../entity';

export class UserMapper extends MapperBase<IamUser> {
  module: AwsIamModule;
  entity = IamUser;
  equals = (a: IamUser, b: IamUser) => {
    return (
      Object.is(a.arn, b.arn) &&
      Object.is(a.userId, b.userId) &&
      isEqual(a.createDate, b.createDate) &&
      Object.is(a.path, b.path) &&
      objectsAreSame(a.attachedPoliciesArns, b.attachedPoliciesArns)
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

  getUserLoginProfile = crudBuilderFormat<IAM, 'getLoginProfile', LoginProfile | undefined>(
    'getLoginProfile',
    UserName => ({ UserName }),
    res => res?.LoginProfile,
  );

  getAllUsers = paginateBuilder<IAM>(paginateListUsers, 'Users');

  updateUserPath = crudBuilder<IAM, 'updateUser'>('updateUser', (UserName, NewPath) => ({
    UserName,
    NewPath,
  }));

  deleteUser = crudBuilder<IAM, 'deleteUser'>('deleteUser', UserName => ({ UserName }));

  deleteLoginProfile = crudBuilder<IAM, 'deleteLoginProfile'>('deleteLoginProfile', UserName => ({
    UserName,
  }));

  async deleteUserLoginProfile(client: IAM, username: string) {
    // first check if we have a profile
    try {
      const profile = await this.getUserLoginProfile(client, username);
      if (profile) await this.deleteLoginProfile(client, profile.UserName);
    } catch (e) {
      if (e instanceof NoSuchEntityException) return;
      else throw new Error('Error deleting user login profile');
    }
  }

  async waitForAttachedUserPolicies(client: IAM, userName: string, policyArns: string[]) {
    // wait for policies to be attached
    const input: ListAttachedUserPoliciesCommandInput = {
      UserName: userName,
    };
    await createWaiter<IAM, ListAttachedUserPoliciesCommandInput>(
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
          const data = await cl.listAttachedUserPolicies(cmd);
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

  attachUserPolicy = crudBuilder<IAM, 'attachUserPolicy'>('attachUserPolicy', (UserName, PolicyArn) => ({
    UserName,
    PolicyArn,
  }));

  attachUserPolicies = (client: IAM, userName: string, policyArns: string[]) =>
    mapLin(policyArns, policyArn => this.attachUserPolicy(client, userName, policyArn));

  detachUserPolicy = crudBuilder<IAM, 'detachUserPolicy'>('detachUserPolicy', (UserName, PolicyArn) => ({
    UserName,
    PolicyArn,
  }));

  detachUserPolicies = (client: IAM, roleName: string, policyArns: string[]) =>
    mapLin(policyArns, (policyArn: string) => this.detachUserPolicy(client, roleName, policyArn));

  getUserAttachedPoliciesArns = crudBuilderFormat<IAM, 'listAttachedUserPolicies', string[] | undefined>(
    'listAttachedUserPolicies',
    UserName => ({ UserName }),
    res => (res?.AttachedPolicies?.length ? res.AttachedPolicies.map(p => p.PolicyArn ?? '') : undefined),
  );

  async userMapper(user: AWSUser, ctx: Context) {
    if (!user.UserName) return undefined;
    const client = (await ctx.getAwsClient()) as AWS;

    const out = new IamUser();
    out.arn = user.Arn;
    out.userName = user.UserName;
    out.userId = user.UserId;
    out.path = user.Path;
    if (user.CreateDate) out.createDate = user.CreateDate;

    try {
      out.attachedPoliciesArns = await this.getUserAttachedPoliciesArns(client.iamClient, user.UserName);
    } catch (e: any) {
      // If could not get policies for the user implies a misconfiguration
      if (e.Code === 'NoSuchEntity') return undefined;
    }
    return out;
  }

  cloud = new Crud({
    create: async (es: IamUser[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const user of es) {
        const rawUser = await this.createNewUser(client.iamClient, {
          UserName: user.userName,
          Path: user.path,
        });

        await waitUntilUserExists(
          {
            client: client.iamClient,
            // all in seconds
            maxWaitTime: 900,
            minDelay: 1,
            maxDelay: 4,
          } as WaiterOptions<IAM>,
          { UserName: user.userName },
        );

        await this.attachUserPolicies(client.iamClient, user.userName, user.attachedPoliciesArns ?? []);
        await this.waitForAttachedUserPolicies(
          client.iamClient,
          user.userName,
          user.attachedPoliciesArns ?? [],
        );
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

          if (!objectsAreSame(e.attachedPoliciesArns, cloudRecord.attachedPoliciesArns)) {
            await this.detachUserPolicies(
              client.iamClient,
              e.userName,
              cloudRecord.attachedPoliciesArns ?? [],
            );
            await this.attachUserPolicies(client.iamClient, e.userName, e.attachedPoliciesArns ?? []);
            await this.waitForAttachedUserPolicies(
              client.iamClient,
              e.userName,
              e.attachedPoliciesArns ?? [],
            );
          }

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
          await this.detachUserPolicies(client.iamClient, e.userName, e.attachedPoliciesArns ?? []);
          await this.waitForAttachedUserPolicies(client.iamClient, e.userName, []);
          await this.deleteUserLoginProfile(client.iamClient, e.userName);
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
