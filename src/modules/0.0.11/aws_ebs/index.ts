import { Volume } from '@aws-sdk/client-ec2'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import { AwsEc2Module } from '../aws_ec2';
import { AvailabilityZone } from '../aws_vpc/entity';
import { GeneralPurposeVolume, GeneralPurposeVolumeType, VolumeState } from './entity'
import * as metadata from './module.json'

export const AwsEbsModule: Module2 = new Module2({
  ...metadata,
  utils: {
    generalPurposeVolumeMapper: async (vol: Volume, ctx: Context) => {
      const out = new GeneralPurposeVolume();
      if (!vol?.VolumeId) return undefined;
      out.volumeId = vol.VolumeId;
      out.volumeType = vol.VolumeType as GeneralPurposeVolumeType;
      out.availabilityZone = vol.AvailabilityZone as AvailabilityZone;
      out.size = vol.Size ?? 1;
      out.iops = vol.Iops;
      out.throughput = vol.Throughput;
      out.state = vol.State as VolumeState;
      if (vol.Attachments?.length) {
        const instanceId = vol.Attachments.pop()?.InstanceId;
        out.attachedInstance = await AwsEc2Module.mappers.instance.db.read(ctx, instanceId) ??
          await AwsEc2Module.mappers.instance.cloud.read(ctx, instanceId);
      }
      if (vol.Tags?.length) {
        const tags: { [key: string]: string } = {};
        vol.Tags.filter((t: any) => !!t.Key && !!t.Value).forEach((t: any) => {
          tags[t.Key as string] = t.Value as string;
        });
        out.tags = tags;
      }
      return out;
    },
    eqTags: (a: { [key: string]: string }, b: { [key: string]: string }) => Object.is(Object.keys(a ?? {})?.length, Object.keys(b ?? {})?.length) &&
      Object.keys(a ?? {})?.every(ak => (a ?? {})[ak] === (b ?? {})[ak]),
  },
  // mappers: {
  //   generalPurposeVolume: new Mapper2<GeneralPurposeVolume>({
  //     entity: GeneralPurposeVolume,
  //     equals: (a: GeneralPurposeVolume, b: GeneralPurposeVolume) => Object.is(a.logGroupName, b.logGroupName)
  //       && Object.is(a.logGroupArn, b.logGroupArn)
  //       && Object.is(a.creationTime?.getTime(), b.creationTime?.getTime()),
  //     source: 'db',
  //     cloud: new Crud2({
  //       create: async (lg: GeneralPurposeVolume[], ctx: Context) => {
  //         const client = await ctx.getAwsClient() as AWS;
  //         const out = []
  //         for (const e of lg) {
  //           await createLogGroup(client.cwClient, e.logGroupName);
  //           // Re-get the inserted record to get all of the relevant records we care about
  //           const newObject = await getLogGroup(client.cwClient, e.logGroupName);
  //           // We map this into the same kind of entity as `obj`
  //           const newEntity = await AwsCloudwatchModule.utils.logGroupMapper(newObject, ctx);
  //           // Save the record back into the database to get the new fields updated
  //           await AwsCloudwatchModule.mappers.logGroup.db.update(newEntity, ctx);
  //           out.push(newEntity);
  //         }
  //         return out;
  //       },
  //       read: async (ctx: Context, id?: string) => {
  //         const client = await ctx.getAwsClient() as AWS;
  //         if (id) {
  //           const rawLogGroup = await getLogGroup(client.cwClient, id);
  //           if (!rawLogGroup) return;
  //           return AwsCloudwatchModule.utils.logGroupMapper(rawLogGroup);
  //         } else {
  //           const logGroups = (await getLogGroups(client.cwClient)) ?? [];
  //           return logGroups.map((lg: any) => AwsCloudwatchModule.utils.logGroupMapper(lg));
  //         }
  //       },
  //       update: async (es: GeneralPurposeVolume[], ctx: Context) => {
  //         // Right now we can only modify AWS-generated fields in the database.
  //         // This implies that on `update`s we only have to restore the values for those records.
  //         const out = [];
  //         for (const e of es) {
  //           const cloudRecord = ctx?.memo?.cloud?.GeneralPurposeVolume?.[e.logGroupName ?? ''];
  //           await AwsCloudwatchModule.mappers.logGroup.db.update(cloudRecord, ctx);
  //           out.push(cloudRecord);
  //         }
  //         return out;
  //       },
  //       delete: async (lg: GeneralPurposeVolume[], ctx: Context) => {
  //         const client = await ctx.getAwsClient() as AWS;
  //         for (const e of lg) {
  //           await deleteLogGroup(client.cwClient, e.logGroupName);
  //         }
  //       },
  //     }),
  //   }),
  // },
}, __dirname);
