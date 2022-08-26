import {
  CreateVolumeCommandInput,
  DescribeVolumesCommandInput,
  DescribeVolumesModificationsCommandInput,
  EC2,
  ModifyVolumeCommandInput,
  Tag as AWSTag,
  Volume as AWSVolume,
  paginateDescribeVolumes,
} from '@aws-sdk/client-ec2';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { GeneralPurposeVolume, GeneralPurposeVolumeType, VolumeState } from '../entity';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../../services/aws_macros';
import { awsVpcModule } from '../..';
import { updateTags, eqTags } from './tags';
import { AwsEc2Module } from '..';

export class GeneralPurposeVolumeMapper extends MapperBase<GeneralPurposeVolume> {
  module: AwsEc2Module;
  entity = GeneralPurposeVolume;
  equals = (a: GeneralPurposeVolume, b: GeneralPurposeVolume) =>
    Object.is(a.attachedInstance?.instanceId, b.attachedInstance?.instanceId) &&
    Object.is(a.instanceDeviceName, b.instanceDeviceName) &&
    Object.is(a?.availabilityZone?.name, b?.availabilityZone?.name) &&
    Object.is(a.iops, b.iops) &&
    Object.is(a.size, b.size) &&
    Object.is(a.state, b.state) &&
    Object.is(a.throughput, b.throughput) &&
    Object.is(a.volumeType, b.volumeType) &&
    Object.is(a.snapshotId, b.snapshotId) &&
    eqTags(a.tags, b.tags);

  async generalPurposeVolumeMapper(vol: AWSVolume, ctx: Context) {
    const out = new GeneralPurposeVolume();
    if (!vol?.VolumeId) return undefined;
    out.volumeId = vol.VolumeId;
    out.volumeType = vol.VolumeType as GeneralPurposeVolumeType;
    out.availabilityZone =
      (await awsVpcModule.availabilityZone.db.read(ctx, vol.AvailabilityZone)) ??
      (await awsVpcModule.availabilityZone.cloud.read(ctx, vol.AvailabilityZone));
    out.size = vol.Size ?? 1;
    out.iops = vol.Iops;
    out.throughput = vol.Throughput;
    out.state = vol.State as VolumeState;
    out.snapshotId = vol.SnapshotId;
    if (vol.Attachments?.length) {
      const attachment = vol.Attachments.pop();
      out.attachedInstance =
        (await this.module.instance.db.read(ctx, attachment?.InstanceId)) ??
        (await this.module.instance.cloud.read(ctx, attachment?.InstanceId));
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
  }

  createVolumeInternal = crudBuilderFormat<EC2, 'createVolume', string | undefined>(
    'createVolume',
    input => input,
    res => res?.VolumeId,
  );

  createVolume = async (client: EC2, input: CreateVolumeCommandInput) => {
    const volumeId = await this.createVolumeInternal(client, input);
    await this.volumeWaiter(client, volumeId ?? '', (vol: AWSVolume | undefined) => {
      // If state is not 'available' OR 'in-use' retry
      if (!Object.is(vol?.State, VolumeState.AVAILABLE) && !Object.is(vol?.State, VolumeState.IN_USE)) {
        return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    });
    return volumeId;
  };

  getGeneralPurposeVolumes = paginateBuilder<EC2>(
    paginateDescribeVolumes,
    'Volumes',
    undefined,
    undefined,
    () => ({
      Filters: [
        {
          Name: 'volume-type',
          Values: ['gp2', 'gp3'],
        },
        {
          Name: 'status',
          Values: ['available', 'in-use', 'error'],
        },
      ],
    }),
  );

  getVolume = crudBuilderFormat<EC2, 'describeVolumes', AWSVolume | undefined>(
    'describeVolumes',
    VolumeId => ({ VolumeIds: [VolumeId] }),
    res => res?.Volumes?.pop(),
  );

  deleteVolumeInternal = crudBuilder2<EC2, 'deleteVolume'>('deleteVolume', VolumeId => ({ VolumeId }));
  deleteVolume = async (client: EC2, VolumeId: string) => {
    await this.deleteVolumeInternal(client, VolumeId);
    await this.waitUntilDeleted(client, VolumeId);
  };

  updateVolumeInternal = crudBuilder2<EC2, 'modifyVolume'>('modifyVolume', input => input);

  updateVolume = async (client: EC2, input: ModifyVolumeCommandInput) => {
    await this.updateVolumeInternal(client, input);
    await this.waitUntilModificationsComplete(client, input.VolumeId ?? '');
  };

  attachVolumeInternal = crudBuilder2<EC2, 'attachVolume'>(
    'attachVolume',
    (VolumeId, InstanceId, Device) => ({
      VolumeId,
      InstanceId,
      Device,
    }),
  );

  attachVolume = async (client: EC2, VolumeId: string, InstanceId: string, Device: string) => {
    await this.attachVolumeInternal(client, VolumeId, InstanceId, Device);
    await this.waitUntilInUse(client, VolumeId);
  };

  detachVolumeInternal = crudBuilder2<EC2, 'detachVolume'>('detachVolume', VolumeId => ({ VolumeId }));

  detachVolume = async (client: EC2, VolumeId: string) => {
    await this.detachVolumeInternal(client, VolumeId);
    await this.waitUntilAvailable(client, VolumeId);
  };

  // TODO: Figure out if/how to macro-ify this thing
  async volumeWaiter(
    client: EC2,
    volumeId: string,
    handleState: (vol: AWSVolume | undefined) => { state: WaiterState },
  ) {
    return createWaiter<EC2, DescribeVolumesCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      {
        VolumeIds: [volumeId],
      },
      async (cl, input) => {
        const data = await cl.describeVolumes(input);
        try {
          const vol = data.Volumes?.pop();
          return handleState(vol);
        } catch (e: any) {
          throw e;
        }
      },
    );
  }

  waitUntilAvailable(client: EC2, volumeId: string) {
    return this.volumeWaiter(client, volumeId, (vol: AWSVolume | undefined) => {
      // If state is not 'in-use' retry
      if (!Object.is(vol?.State, VolumeState.AVAILABLE)) {
        return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    });
  }

  waitUntilInUse(client: EC2, volumeId: string) {
    return this.volumeWaiter(client, volumeId, (vol: AWSVolume | undefined) => {
      // If state is not 'in-use' retry
      if (!Object.is(vol?.State, VolumeState.IN_USE)) {
        return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    });
  }

  waitUntilDeleted(client: EC2, volumeId: string) {
    return this.volumeWaiter(client, volumeId, (vol: AWSVolume | undefined) => {
      // If state is not 'in-use' retry
      if (!Object.is(vol?.State, VolumeState.DELETED)) {
        return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    });
  }

  waitUntilModificationsComplete(client: EC2, volumeId: string) {
    return createWaiter<EC2, DescribeVolumesModificationsCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      {
        VolumeIds: [volumeId],
      },
      async (cl, input) => {
        const data = await cl.describeVolumesModifications(input);
        try {
          const volModif = data.VolumesModifications?.pop();
          // If state is not 'completed' or 'failed' retry
          if (
            !Object.is(volModif?.ModificationState, 'completed') &&
            !Object.is(volModif?.ModificationState, 'failed')
          ) {
            return { state: WaiterState.RETRY };
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      },
    );
  }

  cloud: Crud2<GeneralPurposeVolume> = new Crud2({
    create: async (es: GeneralPurposeVolume[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        if (e.attachedInstance && !e.attachedInstance.instanceId) {
          throw new Error('Want to attach volume to an instance not created yet');
        }
        const input: CreateVolumeCommandInput = {
          AvailabilityZone: e.availabilityZone.name,
          VolumeType: e.volumeType,
          Size: e.size,
          Iops: e.volumeType === GeneralPurposeVolumeType.GP3 ? e.iops : undefined,
          Throughput: e.volumeType === GeneralPurposeVolumeType.GP3 ? e.throughput : undefined,
          SnapshotId: e.snapshotId,
        };
        if (e.tags && Object.keys(e.tags).length) {
          const tags: AWSTag[] = Object.keys(e.tags).map((k: string) => {
            return {
              Key: k,
              Value: e.tags![k],
            };
          });
          input.TagSpecifications = [
            {
              ResourceType: 'volume',
              Tags: tags,
            },
          ];
        }
        const newVolumeId = await this.createVolume(client.ec2client, input);
        if (newVolumeId && e.attachedInstance?.instanceId && e.instanceDeviceName) {
          await this.attachVolume(
            client.ec2client,
            newVolumeId,
            e.attachedInstance.instanceId,
            e.instanceDeviceName,
          );
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getVolume(client.ec2client, newVolumeId);
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.generalPurposeVolumeMapper(newObject, ctx);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        newEntity.id = e.id;
        await this.module.generalPurposeVolume.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = (await ctx.getAwsClient()) as AWS;
      if (id) {
        const rawVolume = await this.getVolume(client.ec2client, id);
        if (!rawVolume) return;
        return this.generalPurposeVolumeMapper(rawVolume, ctx);
      } else {
        const rawVolumes = (await this.getGeneralPurposeVolumes(client.ec2client)) ?? [];
        const out = [];
        for (const vol of rawVolumes) {
          const outVol = await this.generalPurposeVolumeMapper(vol, ctx);
          if (outVol) out.push(outVol);
        }
        return out;
      }
    },
    updateOrReplace: (prev: GeneralPurposeVolume, next: GeneralPurposeVolume) => {
      if (
        !Object.is(prev?.availabilityZone?.name, next?.availabilityZone?.name) ||
        !Object.is(prev.snapshotId, next.snapshotId)
      )
        return 'replace';
      return 'update';
    },
    update: async (es: GeneralPurposeVolume[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.GeneralPurposeVolume?.[e.volumeId ?? ''];
        const isUpdate = this.module.generalPurposeVolume.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          let update = false;
          // Update volume
          if (
            !(
              Object.is(cloudRecord.iops, e.iops) &&
              Object.is(cloudRecord.size, e.size) &&
              Object.is(cloudRecord.throughput, e.throughput) &&
              Object.is(cloudRecord.volumeType, e.volumeType)
            )
          ) {
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
            await this.updateVolume(client.ec2client, input);
            update = true;
          }
          // Update tags
          if (!eqTags(cloudRecord.tags, e.tags)) {
            await updateTags(client.ec2client, e.volumeId ?? '', e.tags);
            update = true;
          }
          // Attach/detach instance
          if (
            !(
              Object.is(cloudRecord.attachedInstance?.instanceId, e.attachedInstance?.instanceId) &&
              Object.is(cloudRecord.instanceDeviceName, e.instanceDeviceName)
            )
          ) {
            if (!cloudRecord.attachedInstance?.instanceId && e.attachedInstance?.instanceId) {
              await this.attachVolume(
                client.ec2client,
                e.volumeId ?? '',
                e.attachedInstance.instanceId,
                e.instanceDeviceName ?? '',
              );
            } else if (cloudRecord.attachedInstance?.instanceId && !e.attachedInstance?.instanceId) {
              await this.detachVolume(client.ec2client, e.volumeId ?? '');
            } else {
              await this.detachVolume(client.ec2client, e.volumeId ?? '');
              await this.attachVolume(
                client.ec2client,
                e.volumeId ?? '',
                e.attachedInstance?.instanceId ?? '',
                e.instanceDeviceName ?? '',
              );
            }
            update = true;
          }
          if (update) {
            const rawVolume = await this.getVolume(client.ec2client, e.volumeId);
            if (!rawVolume) continue;
            const updatedVolume = await this.generalPurposeVolumeMapper(rawVolume, ctx);
            if (!updatedVolume) continue;
            updatedVolume.id = e.id;
            await this.module.generalPurposeVolume.db.update(updatedVolume, ctx);
            out.push(updatedVolume);
          } else {
            // Restore
            cloudRecord.id = e.id;
            await this.module.generalPurposeVolume.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          }
        } else {
          // Replace
          const newVolume = await this.module.generalPurposeVolume.cloud.create(e, ctx);
          await this.module.generalPurposeVolume.cloud.delete(cloudRecord, ctx);
          out.push(newVolume);
        }
      }
      return out;
    },
    delete: async (vol: GeneralPurposeVolume[], ctx: Context) => {
      const client = (await ctx.getAwsClient()) as AWS;
      for (const e of vol) {
        if (e.attachedInstance) {
          await this.detachVolume(client.ec2client, e.volumeId ?? '');
        }
        await this.deleteVolume(client.ec2client, e.volumeId ?? '');
      }
    },
  });

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
