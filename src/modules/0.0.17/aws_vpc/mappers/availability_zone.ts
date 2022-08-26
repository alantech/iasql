import { EC2 } from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { AWS, crudBuilder2 } from '../../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { AvailabilityZone } from '../entity';

export class AvailabilityZoneMapper extends MapperBase<AvailabilityZone> {
  module: AwsVpcModule;
  entity = AvailabilityZone;
  equals = (a: AvailabilityZone, b: AvailabilityZone) => a.name === b.name;

  getAvailabilityZones = crudBuilder2<EC2, 'describeAvailabilityZones'>(
    'describeAvailabilityZones',
    region => ({
      Filters: [
        {
          Name: 'region-name',
          Values: [region],
        },
      ],
    })
  );

  cloud = new Crud2({
    create: async (e: AvailabilityZone[], ctx: Context) => {
      const out = await this.module.availabilityZone.db.delete(e, ctx);
      if (out instanceof Array) {
        return out;
      } else if (!!out) {
        return [out];
      }
    },
    read: async (ctx: Context, name?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const availabilityZones = await this.getAvailabilityZones(client.ec2client, client.region);
      const azs =
        availabilityZones?.AvailabilityZones?.filter(az => !!az.ZoneName).map(az => {
          const out = new AvailabilityZone();
          out.name = az.ZoneName as string; // TS should have figured this out from the filter
          return out;
        }) ?? [];
      if (!!name) return azs.filter(az => az.name === name);
      return azs;
    },
    // Update should never happen because the name is the only field
    update: async (_e: AvailabilityZone[], _ctx: Context) => {
      /* Do nothing */
    },
    delete: async (e: AvailabilityZone[], ctx: Context) => {
      const out = await this.module.availabilityZone.db.create(e, ctx);
      if (out instanceof Array) {
        return out;
      } else if (!!out) {
        return [out];
      }
    },
  });

  constructor(module: AwsVpcModule) {
    super();
    this.module = module;
    super.init();
  }
}
