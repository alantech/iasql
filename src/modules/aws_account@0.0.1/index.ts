import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import { AwsAccountEntity, } from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import * as metadata from './module.json'

export const AwsAccount: Module = new Module({
  ...metadata,
  provides: {
    context: {
      // This function is `async function () {` instead of `async () => {` because that enables the
      // `this` keyword within the function based on the objec it is being called from, so the
      // `getAwsClient` function can access the correct `orm` object with the appropriate creds and
      // read out the right AWS creds and create an AWS client also attached to the current context,
      // which will be different for different users. WARNING: Explicitly trying to access via
      // `AwsAccount.provides.context.getAwsClient` would instead use the context *template* that is
      // global to the codebase.
      async getAwsClient() {
        if (this.awsClient) return this.awsClient;
        const awsCreds = await this.orm.findOne(AwsAccount.mappers.awsAccount.entity);
        this.awsClient = new AWS({
          region: awsCreds.region,
          credentials: {
            accessKeyId: awsCreds.accessKeyId,
            secretAccessKey: awsCreds.secretAccessKey,
          },
        });
        return this.awsClient;
      },
      awsClient: null, // Just reserving this name to guard against collisions between modules.
    },
  },
  mappers: {
    awsAccount: new Mapper<AwsAccountEntity>({
      entity: AwsAccountEntity,
      equals: (_a: AwsAccountEntity, _b: AwsAccountEntity) => true,
      source: 'db',
      cloud: new Crud({
        // We don't actually connect to AWS for this module, because it's meta
        // TODO: Perhaps we should to validate the credentials as being valid?
        create: async (_e: AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        read: (ctx: Context, ids?: string[]) => ctx.orm.find(AwsAccountEntity, ids ? {
          where: {
            id: In(ids),
          },
        } : undefined),
        update: async (_e: AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        delete: async (_e: AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
      }),
    }),
  },
}, __dirname);
