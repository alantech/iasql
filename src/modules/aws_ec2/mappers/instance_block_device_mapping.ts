import {
  EC2,
  InstanceLifecycle,
  InstanceBlockDeviceMapping as AWSInstanceBlockDeviceMapping,
} from '@aws-sdk/client-ec2';
import { Volume as AWSVolume } from '@aws-sdk/client-ec2';
import { WaiterState } from '@aws-sdk/util-waiter';

import { AwsEc2Module } from '..';
import { AWS, crudBuilder } from '../../../services/aws_macros';
import { Context, Crud, IdFields, MapperBase } from '../../interfaces';
import { GeneralPurposeVolume, Instance, InstanceBlockDeviceMapping, VolumeState } from '../entity';

export class InstanceBlockDeviceMappingMapper extends MapperBase<InstanceBlockDeviceMapping> {
  module: AwsEc2Module;
  entity = InstanceBlockDeviceMapping;
  generateId = (fields: IdFields) => {
    const requiredFields = ['instanceId', 'volumeId', 'region'];
    if (
      Object.keys(fields).length !== requiredFields.length &&
      !Object.keys(fields).every(fk => requiredFields.includes(fk))
    ) {
      throw new Error(`Id generation error. Valid fields to generate id are: ${requiredFields.join(', ')}`);
    }
    return `${fields.instanceId}|${fields.volumeId}|${fields.region}`;
  };
  entityId = (e: InstanceBlockDeviceMapping) => {
    return this.module.instanceBlockDeviceMapping.generateId({
      instanceId: e.instance?.instanceId ?? '',
      volumeId: e.volume?.volumeId ?? '',
      region: e.region,
    });
  };

  equals = (a: InstanceBlockDeviceMapping, b: InstanceBlockDeviceMapping) => {
    return Object.is(a.deviceName, b.deviceName) && Object.is(a.deleteOnTermination, b.deleteOnTermination);
  };

  async instanceBlockDeviceMappingMapper(
    newMap: AWSInstanceBlockDeviceMapping,
    instance: Instance,
    ctx: Context,
  ) {
    let volume;
    const region = instance.region;
    if (newMap.Ebs?.VolumeId) {
      volume = await this.module.generalPurposeVolume.db.read(
        ctx,
        this.module.generalPurposeVolume.generateId({ volumeId: newMap.Ebs.VolumeId ?? '', region }),
      );
    } else volume = undefined;

    if (newMap.DeviceName) {
      const res: InstanceBlockDeviceMapping = {
        instanceId: instance?.id ?? undefined,
        volumeId: volume?.id ?? undefined,
        instance,
        volume,
        deviceName: newMap.DeviceName,
        region,
        deleteOnTermination: newMap.Ebs?.DeleteOnTermination ?? true,
      };
      return res;
    } else return undefined;
  }

  attachVolumeInternal = crudBuilder2<EC2, 'attachVolume'>(
    'attachVolume',
    (VolumeId, InstanceId, Device) => ({
      VolumeId,
      InstanceId,
      Device,
    }),
  );

  modifyBlockDeviceMapping = crudBuilder2<EC2, 'modifyInstanceAttribute'>(
    'modifyInstanceAttribute',
    (InstanceId, BlockDeviceMappings) => ({
      InstanceId,
      BlockDeviceMappings,
    }),
  );

  waitUntilAvailable(client: EC2, volumeId: string) {
    return this.module.generalPurposeVolume.volumeWaiter(client, volumeId, (vol: AWSVolume | undefined) => {
      // If state is not 'in-use' retry
      if (!Object.is(vol?.State, VolumeState.AVAILABLE)) {
        return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    });
  }

  detachVolumeInternal = crudBuilder<EC2, 'detachVolume'>('detachVolume', VolumeId => ({ VolumeId }));

  detachVolume = async (client: EC2, VolumeId: string) => {
    await this.detachVolumeInternal(client, VolumeId);
    await this.waitUntilAvailable(client, VolumeId);
  };

  waitUntilInUse(client: EC2, volumeId: string) {
    return this.module.generalPurposeVolume.volumeWaiter(client, volumeId, (vol: AWSVolume | undefined) => {
      // If state is not 'in-use' retry
      if (!Object.is(vol?.State, VolumeState.IN_USE)) {
        return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    });
  }

  attachVolume = async (client: EC2, VolumeId: string, InstanceId: string, Device: string) => {
    const result = await this.attachVolumeInternal(client, VolumeId, InstanceId, Device);
    if (result) await this.waitUntilInUse(client, VolumeId);
    else return false;
    return true;
  };

  cloud: Crud<InstanceBlockDeviceMapping> = new Crud({
    create: async (es: InstanceBlockDeviceMapping[], ctx: Context) => {
      const out: InstanceBlockDeviceMapping[] = [];
      for (const e of es) {
        // read instance details
        const instance: Instance = await ctx.orm.findOne(Instance, {
          id: e.instanceId,
        });

        // if we have different regions we may be in a multi-region update situation, just skip
        if (e.region !== instance.region) continue;

        // if instance is not created we are in the first step, no need to create anything
        if (!instance?.instanceId) continue;
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // read volume details
        if (!e.volumeId) throw new Error('Cannot attach empty volumes to an instance already created');
        const volume: GeneralPurposeVolume = await ctx.orm.findOne(GeneralPurposeVolume, {
          id: e.volumeId,
        });
        if (!volume.volumeId) throw new Error('Tried to attach an unexisting volume');
        if (volume.region !== instance.region)
          throw new Error('Cannot create a mapping between different regions');

        // only attach if volume is not in use. We can have the case that the volume is auto-attached on creation
        if (volume.state === VolumeState.AVAILABLE) {
          await this.attachVolume(client.ec2client, volume.volumeId, instance.instanceId, e.deviceName);
        }

        // return mapping
        const newMap: InstanceBlockDeviceMapping = {
          deviceName: e.deviceName,
          instanceId: e.instanceId,
          instance,
          volumeId: e.volumeId,
          volume,
          region: instance.region,
          deleteOnTermination: e.deleteOnTermination,
        };

        // Save the record back into the database to get the new fields updated
        newMap.id = e.id;
        await this.module.instanceBlockDeviceMapping.db.update(newMap, ctx);
        out.push(newMap);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      if (id) {
        // decompose the id
        const { instanceId, volumeId, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;

        // check if we can find the instance in database
        const instance = await this.module.instance.db.read(
          ctx,
          this.module.instance.generateId({ instanceId: instanceId ?? '', region }),
        );

        if (instance) {
          // read the instance mapping
          const mapping = await this.module.instance.getInstanceBlockDeviceMapping(
            client.ec2client,
            instanceId,
          );
          for (const newMap of mapping ?? []) {
            if (newMap.DeviceName && newMap.Ebs?.VolumeId === volumeId) {
              const res = await this.instanceBlockDeviceMappingMapper(newMap, instance, ctx);
              return res;
            }
          }
        }
      } else {
        const out: InstanceBlockDeviceMapping[] = [];
        const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawInstances = (await this.module.instance.getInstances(client.ec2client)) ?? [];
            for (const i of rawInstances) {
              // exclude spot instances and terminating ones
              if (i.InstanceLifecycle === InstanceLifecycle.SPOT) continue;
              if (i.State?.Name === 'terminated' || i.State?.Name === 'shutting-down') continue;
              if (!i.InstanceId) continue; // if we do not have an id we skip

              // check instance block device mappings
              const mapping = await this.module.instance.getInstanceBlockDeviceMapping(
                client.ec2client,
                i.InstanceId,
              );

              // check if we can find the instance in database
              const instance = await this.module.instance.db.read(
                ctx,
                this.module.instance.generateId({ instanceId: i.InstanceId ?? '', region }),
              );
              if (instance) {
                for (const newMap of mapping ?? []) {
                  if (newMap.DeviceName && newMap.Ebs?.VolumeId) {
                    const volume = await this.module.generalPurposeVolume.db.read(
                      ctx,
                      this.module.generalPurposeVolume.generateId({
                        volumeId: newMap.Ebs.VolumeId ?? '',
                        region,
                      }),
                    );
                    const res = await this.instanceBlockDeviceMappingMapper(newMap, instance, ctx);
                    if (res) out.push(res);
                  }
                }
              }
            }
          }),
        );
        return out;
      }
    },
    update: async (es: InstanceBlockDeviceMapping[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.InstanceBlockDeviceMapping?.[this.entityId(e)];

        if (e.deleteOnTermination !== cloudRecord.deleteOnTermination) {
          // we need to update the delete on termination for that specific device
          const mappings = await this.module.instance.getInstanceBlockDeviceMapping(
            client.ec2client,
            e.instance.instanceId,
          );
          for (const newMap of mappings ?? []) {
            if (newMap.DeviceName === e.deviceName && newMap.Ebs?.VolumeId === e.volume?.volumeId)
              newMap.Ebs!.DeleteOnTermination = e.deleteOnTermination;
            const result = await this.modifyBlockDeviceMapping(
              client.ec2client,
              e.instance.instanceId,
              mappings,
            );
            if (result) out.push(e);
          }
        } else {
          // the only case for update is to change the device name, we will need to delete and recreate
          await this.module.instanceBlockDeviceMapping.cloud.delete(e, ctx);
          const newMap = await this.module.instanceBlockDeviceMapping.cloud.create(e, ctx);
          if (!newMap) continue;
          out.push(e);
        }
      }
      return out;
    },
    delete: async (es: InstanceBlockDeviceMapping[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // if no volume is attached, no need to do anything
        if (!e.volume?.volumeId) continue;

        // we need to detach the volume
        try {
          await this.detachVolume(client.ec2client, e.volume.volumeId ?? '');
        } catch (_) {
          continue; // if the volume is still attached we will wait for the next run
        }
      }
    },
  });

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
