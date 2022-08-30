import { AWS } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { AwsAccountEntity } from './entity';

class AccountMapper extends MapperBase<AwsAccountEntity> {
  module: AwsAccount;
  entity = AwsAccountEntity;
  equals = (_a: AwsAccountEntity, _b: AwsAccountEntity) => true;
  cloud = new Crud2<AwsAccountEntity>({
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
          : undefined,
      ),
    update: async (_e: AwsAccountEntity[], _ctx: Context) => {
      /* Do nothing */
    },
    delete: async (_e: AwsAccountEntity[], _ctx: Context) => {
      /* Do nothing */
    },
  });

  constructor(module: AwsAccount) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsAccount extends ModuleBase {
  context: Context = {
    // This function is `async function () {` instead of `async () => {` because that enables the
    // `this` keyword within the function based on the objec it is being called from, so the
    // `getAwsClient` function can access the correct `orm` object with the appropriate creds and
    // read out the right AWS creds and create an AWS client also attached to the current context,
    // which will be different for different users. WARNING: Explicitly trying to access via
    // `AwsAccount.provides.context.getAwsClient` would instead use the context *template* that is
    // global to the codebase.
    async getAwsClient() {
      if (this.awsClient) return this.awsClient;
      const orm = this.orm;
      const awsCreds = await orm.findOne(awsAccount.awsAccount.entity);
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
  };
  awsAccount: AccountMapper;

  constructor() {
    super();
    this.awsAccount = new AccountMapper(this);
    super.init();
  }
}
export const awsAccount = new AwsAccount();
