import { AWS, } from '../../services/gateways/aws'
import { AwsAccountEntity, } from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { awsAccount1635286464133, } from './migration/1635286464133-aws_account'

export const AwsAccount = new Module({
  name: 'aws_account',
  dependencies: [],
  provides: {
    tables: ['aws_account'],
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
      entityId: (e: AwsAccountEntity) => e.region,
      equals: (_a: AwsAccountEntity, _b: AwsAccountEntity) => true,
      source: 'db',
      db: new Crud({
        create: async (e: AwsAccountEntity | AwsAccountEntity[], ctx: Context) => { await ctx.orm.save(AwsAccountEntity, e); },
        read: (ctx: Context, options: any) => ctx.orm.find(AwsAccountEntity, options),
        update: async (e: AwsAccountEntity | AwsAccountEntity[], ctx: Context) => { await ctx.orm.save(AwsAccountEntity, e); },
        delete: async (e: AwsAccountEntity | AwsAccountEntity[], ctx: Context) => { await ctx.orm.remove(AwsAccountEntity, e); },
      }),
      cloud: new Crud({
        // We don't actually connect to AWS for this module, because it's meta
        // TODO: Perhaps we should to validate the credentials as being valid?
        create: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        read: async (ctx: Context, options: any) => ctx.orm.find(AwsAccountEntity, options),
        update: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
        delete: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => { /* Do nothing */ },
      }),
    }),
  },
  migrations: {
    postinstall: awsAccount1635286464133.prototype.up,
    preremove: awsAccount1635286464133.prototype.down,
  },
});
