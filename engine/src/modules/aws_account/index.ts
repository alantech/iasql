import { AWS, } from '../../services/gateways/aws'
import { AwsAccountEntity, } from './entity'
import { Context, MapperInterface, ModuleInterface, Crud, } from '../interfaces'
import { awsAccount1635286464133, } from './migration/1635286464133-aws_account'

export const AwsAccount: ModuleInterface = {
  name: 'aws_account',
  dependencies: [],
  provides: {
    tables: ['aws_account'],
    context: {
      getAwsClient: async function () {
        // Does `this` work here to grab the ctx object?
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
    },
  },
  mappers: {
    awsAccount: {
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
        create: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => {},
        read: async (ctx: Context, options: any) => ctx.orm.find(AwsAccountEntity, options),
        update: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => {},
        delete: async (_e: AwsAccountEntity | AwsAccountEntity[], _ctx: Context) => {},
      }),
    } as MapperInterface<AwsAccountEntity>,
  },
  migrations: {
    postinstall: awsAccount1635286464133.prototype.up,
    preremove: awsAccount1635286464133.prototype.down,
  },
};
