import { AWS } from '../../../services/aws_macros';
import { AwsAccountEntity } from './entity';
import { Context, Crud2, Mapper2, Module2 } from '../../interfaces';
import * as metadata from './module.json';

export const AwsAccount: Module2 = new Module2(
  {
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
          const orm = this.orm;
          if (this.awsClient) return this.awsClient;
          const awsCreds = await orm.findOne(AwsAccount.mappers.awsAccount.entity);
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
      awsAccount: new Mapper2<AwsAccountEntity>({
        entity: AwsAccountEntity,
        equals: (_a: AwsAccountEntity, _b: AwsAccountEntity) => true,
        source: 'db',
        cloud: new Crud2({
          create: async (_e: AwsAccountEntity[], _ctx: Context) => {
            /* Do nothing */
          },
          read: (ctx: Context, id?: string) =>
            ctx.orm.find(
              AwsAccountEntity,
              id
                ? {
                    where: {
                      id,
                    },
                  }
                : undefined
            ),
          update: async (_e: AwsAccountEntity[], _ctx: Context) => {
            /* Do nothing */
          },
          delete: async (_e: AwsAccountEntity[], _ctx: Context) => {
            /* Do nothing */
          },
        }),
      }),
    },
  },
  __dirname
);
