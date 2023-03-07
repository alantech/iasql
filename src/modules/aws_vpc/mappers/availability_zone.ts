import { EC2 } from '@aws-sdk/client-ec2';

import { AwsVpcModule } from '..';
import { AWS, crudBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { AvailabilityZone } from '../entity';

export class AvailabilityZoneMapper extends MapperBase<AvailabilityZone> {
  module: AwsVpcModule;
  entity = AvailabilityZone;
  equals = (a: AvailabilityZone, b: AvailabilityZone) => a.name === b.name;

  getAvailabilityZones = crudBuilder<EC2, 'describeAvailabilityZones'>(
    'describeAvailabilityZones',
    region => ({
      Filters: [
        {
          Name: 'region-name',
          Values: [region],
        },
      ],
    }),
  );

  cloud = new Crud({
    create: async (e: AvailabilityZone[], ctx: Context) => {
      const out = await this.module.availabilityZone.db.delete(e, ctx);
      if (out instanceof Array) {
        return out;
      } else if (!!out) {
        return [out];
      }
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      const outAzs: AvailabilityZone[] = [];
      await Promise.all(
        enabledRegions.map(async region => {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const availabilityZones = await this.getAvailabilityZones(client.ec2client, region);
          const azs =
            availabilityZones?.AvailabilityZones?.filter(az => !!az.ZoneName).map(az => {
              const out = new AvailabilityZone();
              out.name = az.ZoneName as string; // TS should have figured this out from the filter
              out.region = az.RegionName as string;
              return out;
            }) ?? [];
          outAzs.push(...azs);
        }),
      );
      if (!!id) {
        const { name, region } = this.idFields(id);
        return outAzs.find(az => az.name === name && az.region === region);
      }
      return outAzs;
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
