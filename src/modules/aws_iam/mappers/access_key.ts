import isEqual from 'lodash.isequal';

import {
  AccessKeyMetadata,
  IAM,
  paginateListAccessKeys,
  UpdateAccessKeyCommandInput,
} from '@aws-sdk/client-iam';

import { awsIamModule, AwsIamModule } from '..';
import { AWS, crudBuilder, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { AccessKey, accessKeyStatusEnum, IamUser } from '../entity';

export class AccessKeyMapper extends MapperBase<AccessKey> {
  module: AwsIamModule;
  entity = AccessKey;
  equals = (a: AccessKey, b: AccessKey) =>
    isEqual(a.createDate, b.createDate) && Object.is(a.status, b.status);

  async accessKeyMapper(e: AccessKeyMetadata, ctx: Context) {
    const out = new AccessKey();
    if (!e.AccessKeyId) return undefined;

    out.accessKeyId = e.AccessKeyId;
    if (e.CreateDate) out.createDate = e.CreateDate;
    if (e.Status) out.status = e.Status as accessKeyStatusEnum;

    if (e.UserName) {
      // retrieve user and map it
      if (!Object.values(ctx.memo?.cloud?.IamUser ?? {}).length) {
        out.user =
          (await awsIamModule.user.db.read(ctx, e.UserName)) ??
          (await awsIamModule.user.cloud.read(ctx, e.UserName));
      } else {
        out.user =
          (await awsIamModule.user.db.read(ctx, e.UserName)) ?? ctx?.memo?.cloud?.IamUser?.[e.UserName ?? ''];
      }
    }
    return out;
  }

  getUserKeys = paginateBuilder<IAM>(
    paginateListAccessKeys,
    'AccessKeyMetadata',
    undefined,
    undefined,
    UserName => ({ UserName }),
  );

  getAllKeys = paginateBuilder<IAM>(paginateListAccessKeys, 'AccessKeyMetadata');

  async deleteAccessKey(client: IAM, userName: string, keyId: string) {
    await client.deleteAccessKey({ UserName: userName, AccessKeyId: keyId });
  }

  updateAccessKey = crudBuilder<IAM, 'updateAccessKey'>('updateAccessKey', input => input);

  cloud = new Crud<AccessKey>({
    create: async (es: AccessKey[], ctx: Context) => {
      // Do not cloud create, just restore database
      await this.module.accessKey.db.delete(es, ctx);
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;

      if (id) {
        const { keyId, user } = this.idFields(id);
        const keys = await this.getUserKeys(client.iamClient, user);

        if (!keys || keys.length === 0) return undefined;

        // search for the matching key
        for (const key of keys) {
          if (Object.is(key.AccessKeyId, keyId)) return await this.accessKeyMapper(key, ctx);
        }
        return undefined;
      } else {
        // list all possible users
        const users: IamUser[] | undefined = await awsIamModule.user.cloud.read(ctx);
        if (!users || users.length === 0) return undefined;

        const out: AccessKey[] = [];
        for (const user of users) {
          const keys = await this.getUserKeys(client.iamClient, user.userName);
          if (keys && keys.length > 0) {
            // add keys
            for (const key of keys) {
              const mappedKey = await this.accessKeyMapper(key, ctx);
              if (mappedKey) out.push(mappedKey);
            }
          }
        }
        return out;
      }
    },
    updateOrReplace: (prev: AccessKey, next: AccessKey) => {
      if (!Object.is(prev.status, next.status)) return 'update';
      else return 'replace';
    },
    update: async (es: AccessKey[], ctx: Context) => {
      const out = [];
      const client = (await ctx.getAwsClient()) as AWS;

      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.AccessKey?.[this.entityId(e)];

        const isUpdate = this.module.accessKey.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          const input: UpdateAccessKeyCommandInput = {
            AccessKeyId: e.accessKeyId,
            UserName: e.user.userName,
            Status: e.status,
          };
          await this.updateAccessKey(client.iamClient, input);

          // retrieve the latest key
          const updatedKey = await awsIamModule.accessKey.db.read(
            ctx,
            this.module.accessKey.generateId({ accessKeyId: e.accessKeyId, user: e.user.userName }),
          );
          if (updatedKey) {
            await this.module.accessKey.db.update(updatedKey, ctx);
            out.push(updatedKey);
          }
        } else {
          // if we have modified some of the values, we just restore them
          await this.module.accessKey.db.update(e, ctx);
          out.push(e);
        }
      }
      return out;
    },
    delete: async (es: AccessKey[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;

      for (const e of es) {
        await this.deleteAccessKey(client.iamClient, e.user.userName, e.accessKeyId);
      }
    },
  });

  constructor(module: AwsIamModule) {
    super();
    this.module = module;
    super.init();
  }
}
