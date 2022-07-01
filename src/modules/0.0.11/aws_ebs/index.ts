import { CreateVolumeCommandInput, ModifyVolumeCommandInput, Tag, Volume } from '@aws-sdk/client-ec2'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import { AwsEc2Module } from '../aws_ec2';
import { AvailabilityZone } from '../aws_vpc/entity';
import {
  AWS,
  createVolume,
  deleteVolume,
  getVolume,
  getGeneralPurposeVolumes,
  attachVolume,
  detachVolume,
  updateVolume,
  updateTags,
} from './aws_helper';
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
      out.snapshotId = vol.SnapshotId;
      if (vol.Attachments?.length) {
        const attachment = vol.Attachments.pop();
        out.attachedInstance = await AwsEc2Module.mappers.instance.db.read(ctx, attachment?.InstanceId) ??
          await AwsEc2Module.mappers.instance.cloud.read(ctx, attachment?.InstanceId);
        out.instanceDeviceName = attachment?.Device;
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
  mappers: {
    generalPurposeVolume: new Mapper2<GeneralPurposeVolume>({
      entity: GeneralPurposeVolume,
      equals: (a: GeneralPurposeVolume, b: GeneralPurposeVolume) => Object.is(a.attachedInstance?.instanceId, b.attachedInstance?.instanceId)
        && Object.is(a.instanceDeviceName, b.instanceDeviceName)
        && Object.is(a.availabilityZone, b.availabilityZone)
        && Object.is(a.iops, b.iops)
        && Object.is(a.size, b.size)
        && Object.is(a.state, b.state)
        && Object.is(a.throughput, b.throughput)
        && Object.is(a.volumeType, b.volumeType)
        && Object.is(a.snapshotId, b.snapshotId)
        && AwsEbsModule.utils.eqTags(a.tags, b.tags),
      source: 'db',
      cloud: new Crud2({
        create: async (es: GeneralPurposeVolume[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = []
          for (const e of es) {
            if (e.attachedInstance && !e.attachedInstance.instanceId) {
              throw new Error('Want to attach volume to an instance not created yet');
            }
            const input: CreateVolumeCommandInput = {
              AvailabilityZone: e.availabilityZone,
              VolumeType: e.volumeType,
              Size: e.size,
              Iops: e.volumeType === GeneralPurposeVolumeType.GP3 ? e.iops : undefined,
              Throughput:  e.volumeType === GeneralPurposeVolumeType.GP3 ? e.throughput : undefined,
              SnapshotId: e.snapshotId,
            };
            if (e.tags && Object.keys(e.tags).length) {
              const tags: Tag[] = Object.keys(e.tags).map((k: string) => {
                return {
                  Key: k, Value: e.tags![k],
                }
              });
              input.TagSpecifications = [
                {
                  ResourceType: 'volume',
                  Tags: tags,
                },
              ]
            }
            const newVolumeId = await createVolume(client.ec2client, input);
            if (newVolumeId && e.attachedInstance?.instanceId && e.instanceDeviceName) {
              await attachVolume(client.ec2client, newVolumeId, e.attachedInstance.instanceId, e.instanceDeviceName);
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await getVolume(client.ec2client, newVolumeId);
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsEbsModule.utils.generalPurposeVolumeMapper(newObject, ctx);
            // Save the record back into the database to get the new fields updated
            newEntity.id = e.id;
            await AwsEbsModule.mappers.generalPurposeVolume.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawVolume = await getVolume(client.ec2client, id);
            if (!rawVolume) return;
            return AwsEbsModule.utils.generalPurposeVolumeMapper(rawVolume, ctx);
          } else {
            const rawVolumes = (await getGeneralPurposeVolumes(client.ec2client)) ?? [];
            const out = [];
            for (const vol of rawVolumes) {
              out.push(await AwsEbsModule.utils.generalPurposeVolumeMapper(vol, ctx));
            }
            return out;
          }
        },
        updateOrReplace: (prev: GeneralPurposeVolume, next: GeneralPurposeVolume) => {
          if (!Object.is(prev.availabilityZone, next.availabilityZone) || !Object.is(prev.snapshotId, next.snapshotId)) return 'replace';
          return 'update';
        },
        update: async (es: GeneralPurposeVolume[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.GeneralPurposeVolume?.[e.volumeId ?? ''];
            // TODO: implement update/restore. Do not let replace until we handle correctly snapshots
            const isUpdate = AwsEbsModule.mappers.generalPurposeVolume.cloud.updateOrReplace(cloudRecord, e) === 'update';
            if (isUpdate) {
              let update = false;
              // Update volume
              if (!(Object.is(cloudRecord.iops, e.iops) && Object.is(cloudRecord.size, e.size)
                && Object.is(cloudRecord.throughput, e.throughput) && Object.is(cloudRecord.volumeType, e.volumeType))) {
                if (e.volumeType === GeneralPurposeVolumeType.GP2) {
                  e.throughput = undefined;
                  e.iops = undefined;
                }
                const input: ModifyVolumeCommandInput = {
                  VolumeId: e.volumeId,
                  Size: e.size,
                  Throughput: e.volumeType === GeneralPurposeVolumeType.GP3 ? e.throughput : undefined,
                  Iops: e.volumeType === GeneralPurposeVolumeType.GP3 ? e.iops : undefined,
                  VolumeType: e.volumeType,
                };
                await updateVolume(client.ec2client, input)
                update = true;
              }
              // Update tags
              if (!AwsEbsModule.utils.eqTags(cloudRecord.tags, e.tags)) {
                await updateTags(client.ec2client, 'volume', e.tags);
                update = true;
              }
              // Attach/detach instance
              if (!(Object.is(cloudRecord.attachedInstance?.instanceId, e.attachedInstance?.instanceId) 
                && Object.is(cloudRecord.instanceDeviceName, e.instanceDeviceName))) {
                if (!cloudRecord.attachedInstance?.instanceId && e.attachedInstance?.instanceId) {
                  await attachVolume(client.ec2client, e.volumeId ?? '', e.attachedInstance.instanceId, e.instanceDeviceName ?? '');
                } else if (cloudRecord.attachedInstance?.instanceId && !e.attachedInstance?.instanceId) {
                  await detachVolume(client.ec2client, e.volumeId ?? '');
                } else {
                  await detachVolume(client.ec2client, e.volumeId ?? '');
                  await attachVolume(client.ec2client, e.volumeId ?? '', e.attachedInstance?.instanceId ?? '', e.instanceDeviceName ?? '');
                }
                update = true;
              }
              if (update) {
                const rawVolume = await getVolume(client.ec2client, e.volumeId);
                const updatedVolume = await AwsEbsModule.utils.generalPurposeVolumeMapper(rawVolume, ctx);
                updatedVolume.id = e.id;
                await AwsEbsModule.mappers.generalPurposeVolume.db.update(updatedVolume, ctx);
                out.push(updatedVolume);
              } else {
                // Restore
                cloudRecord.id = e.id;
                await AwsEbsModule.mappers.generalPurposeVolume.db.update(cloudRecord, ctx);
                out.push(cloudRecord);
              }
            } else {
              // Replace
              const newVolume = await AwsEbsModule.mappers.generalPurposeVolume.cloud.create(e, ctx);
              await AwsEbsModule.mappers.generalPurposeVolume.cloud.delete(cloudRecord, ctx);
              out.push(newVolume);
            }
          }
          return out;
        },
        delete: async (vol: GeneralPurposeVolume[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of vol) {
            if (e.attachedInstance) {
              await detachVolume(client.ec2client, e.volumeId ?? '');
            }
            await deleteVolume(client.ec2client, e.volumeId);
          }
        },
      }),
    }),
  },
}, __dirname);
