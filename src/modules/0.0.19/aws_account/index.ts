import { EC2 } from '@aws-sdk/client-ec2';

import { AWS, crudBuilderFormat } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase, ModuleBase } from '../../interfaces';
import { AwsCredentials, AwsRegions } from './entity';

class CredentialsMapper extends MapperBase<AwsCredentials> {
  module: AwsAccount;
  entity = AwsCredentials;
  equals = (_a: AwsCredentials, _b: AwsCredentials) => true;
  cloud = new Crud2<AwsCredentials>({
    create: async (_e: AwsCredentials[], _ctx: Context) => {
      /* Do nothing */
    },
    read: (ctx: Context, id?: string) =>
      ctx.orm.find(
        AwsCredentials,
        id
          ? {
              where: {
                id,
              },
            }
          : undefined,
      ),
    update: async (_e: AwsCredentials[], _ctx: Context) => {
      /* Do nothing */
    },
    delete: async (_e: AwsCredentials[], _ctx: Context) => {
      /* Do nothing */
    },
  });

  constructor(module: AwsAccount) {
    super();
    this.module = module;
    super.init();
  }
}

class RegionsMapper extends MapperBase<AwsRegions> {
  module: AwsAccount;
  entity = AwsRegions;
  equals = (a: AwsRegions, b: AwsRegions) =>
    a.region === b.region && a.isDefault === b.isDefault && a.isEnabled === b.isEnabled;

  getRegions = crudBuilderFormat<EC2, 'describeRegions', string[]>(
    'describeRegions',
    () => ({}),
    res => res?.Regions?.map(r => r.RegionName ?? '').filter(r => r !== '') ?? [],
  );

  cloud = new Crud2<AwsRegions>({
    create: async (e: AwsRegions[], ctx: Context) => {
      // Just immediately revert, we can't create regions in the cloud
      const out = await this.module.awsRegions.db.delete(e, ctx);
      if (!out || out instanceof Array) return out;
      return [out];
    },
    read: async (ctx: Context, region?: string) => {
      const client = await ctx.getAwsClient();
      if (region) {
        const awsRegion = new AwsRegions();
        awsRegion.isDefault = false;
        awsRegion.isEnabled = true;
        awsRegion.region = region;
        return awsRegion;
      }
      return (await this.getRegions(client.ec2client)).map(r => {
        const awsRegion = new AwsRegions();
        awsRegion.isDefault = false;
        awsRegion.isEnabled = true;
        awsRegion.region = r;
        return awsRegion;
      });
    },
    update: async (_e: AwsRegions[], _ctx: Context) => {
      // The only controllable fields here have nothing to do with AWS itself, but for how IaSQL works
      // with multiple regions, so we can literally no-op this one.
    },
    delete: async (e: AwsRegions[], ctx: Context) => {
      // You can't delete regions, just restore them back
      const out = await this.module.awsRegions.db.create(e, ctx);
      if (!out || out instanceof Array) return out;
      return [out];
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
    // `this` keyword within the function based on the object it is being called from, so the
    // `getAwsClient` function can access the correct `orm` object with the appropriate creds and
    // read out the right AWS creds and create an AWS client also attached to the current context,
    // which will be different for different users. The client cache is based on the region chosen,
    // and it assumes that the credentials do not change mid-operation.
    async getAwsClient(selectedRegion?: string) {
      const orm = this.orm;
      const region =
        selectedRegion ??
        (await orm.findOne(AwsRegions, {
          where: {
            isDefault: true,
          },
        })) ??
        'us-east-1'; // TODO: Eliminate this last fallback
      if (this.awsClient[region]) return this.awsClient[region];
      const awsCreds = await orm.findOne(AwsCredentials);
      if (!awsCreds) throw new Error('No credentials found');
      this.awsClient[region] = new AWS({
        region,
        credentials: {
          accessKeyId: awsCreds.accessKeyId,
          secretAccessKey: awsCreds.secretAccessKey,
        },
      });
      return this.awsClient[region];
    },
    awsClient: {}, // Initializing this cache with no clients. The cache doesn't expire explicitly
    // as we simply drop the context at the end of the execution.
    // This function returns the list of regions that are currently enabled, allowing multi-region
    // aware modules to request which regions they should operate on beyond the default region. The
    // full AwsRegions entities may be optionally returned if there is some special logic involving
    // the default region, perhaps, that is desired.
    async getEnabledAwsRegions(fullEntities = false) {
      const orm = this.orm;
      const awsRegions = await orm.find(AwsRegions, {
        where: {
          isEnabled: true,
        },
      });
      return fullEntities ? awsRegions : awsRegions.map((r: AwsRegions) => r.region);
    },
  };
  awsCredentials: CredentialsMapper;
  awsRegions: RegionsMapper;

  constructor() {
    super();
    this.awsCredentials = new CredentialsMapper(this);
    this.awsRegions = new RegionsMapper(this);
    super.init();
  }
}
export const awsAccount = new AwsAccount();
