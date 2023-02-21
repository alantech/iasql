import {
  DescribeVolumesCommandInput,
  EC2,
  InstanceBlockDeviceMapping as AWSInstanceBlockDeviceMapping,
  InstanceLifecycle,
} from '@aws-sdk/client-ec2';
import { Volume as AWSVolume } from '@aws-sdk/client-ec2';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsEc2Module } from '..';
import { AWS, crudBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import { GeneralPurposeVolume, Instance, InstanceBlockDeviceMapping, VolumeState } from '../entity';

export class InstanceBlockDeviceMappingMapper extends MapperBase<InstanceBlockDeviceMapping> {
  module: AwsEc2Module;
  entity = InstanceBlockDeviceMapping;
  equals = (a: InstanceBlockDeviceMapping, b: InstanceBlockDeviceMapping) => {
    return Object.is(a.deviceName, b.deviceName);
  };

  async instanceBlockDeviceMappingMapper(
    vol: AWSInstanceBlockDeviceMapping,
    instance: Instance,
    ctx: Context,
  ) {
    const out = new InstanceBlockDeviceMapping();
    if (!vol.DeviceName) return undefined;
    out.instanceId = instance.id!;
    out.instance = instance;
    out.deviceName = vol.DeviceName;
    out.region = instance.region;

    // read id for the volume
    if (vol.Ebs?.VolumeId) {
      const region = instance.region;
      const volume = await this.module.generalPurposeVolume.db.read(
        ctx,
        this.module.generalPurposeVolume.generateId({ volumeId: vol.Ebs?.VolumeId, region }),
      );

      if (!volume) return undefined; // we still do not have the volume mapped
      out.volumeId = volume.id;
      out.volume = volume;
    } else out.volumeId = undefined;
    return out;
  }

  attachVolumeInternal = crudBuilder<EC2, 'attachVolume'>('attachVolume', (VolumeId, InstanceId, Device) => ({
    VolumeId,
    InstanceId,
    Device,
  }));

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
        if (instance.region != e.region) throw new Error('Cannot create a mapping between different regions');

        // if instance is not created we are in the first step, no need to create anything
        if (!instance?.instanceId) continue;
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // read volume details
        if (!e.volumeId) throw new Error('Cannot attach empty volumes to an instance already created');
        const volume: GeneralPurposeVolume = await ctx.orm.findOne(GeneralPurposeVolume, {
          id: e.volumeId,
        });
        if (!volume.volumeId) throw new Error('Tried to attach an unexisting volume');
        if (volume.state == VolumeState.IN_USE)
          throw new Error('Cannot attach volumes that are already in use');
        if (volume.region != e.region) throw new Error('Cannot create a mapping between different regions');

        // if it is a volume for an existing instance we need to attach it
        const result = await this.attachVolume(
          client.ec2client,
          volume.volumeId,
          instance.instanceId,
          e.deviceName,
        );
        if (result) out.push(e);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      if (id) {
        return undefined;
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

              // read the instance mapping
              const instance = await this.module.instance.db.read(
                ctx,
                this.module.instance.generateId({ instanceId: i.InstanceId ?? '', region }),
              );

              if (instance) {
                // check instance block device mappings
                const mapping = await this.module.instance.getInstanceBlockDeviceMapping(
                  client.ec2client,
                  i.InstanceId,
                );
                for (const map of i.BlockDeviceMappings ?? []) {
                  const m = await this.instanceBlockDeviceMappingMapper(map, instance, ctx);
                  if (m) out.push(m);
                }
              }
            }
          }),
        );
        return out;
      }
    },
    update: async (es: InstanceBlockDeviceMapping[], ctx: Context) => {
      const out: InstanceBlockDeviceMapping[] = [];
      for (const e of es) {
        // the only case for update is to change the device name, we will need to delete and recreate
        await this.module.instanceBlockDeviceMapping.cloud.delete(e, ctx);
        await this.module.instanceBlockDeviceMapping.cloud.create(e, ctx);
      }
      return out;
    },
    delete: async (es: InstanceBlockDeviceMapping[], ctx: Context) => {
      for (const e of es) {
        console.log(e);
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // if no volume is attached, no need to do anything
        if (!e.volumeId) continue;

        const volume: GeneralPurposeVolume = await ctx.orm.findOne(GeneralPurposeVolume, {
          id: e.volumeId,
        });
        if (!volume.volumeId) throw new Error('Tried to detach an unexisting volume');

        // we need to detach the volume
        await this.detachVolume(client.ec2client, volume.volumeId ?? '');
      }
    },
  });

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
