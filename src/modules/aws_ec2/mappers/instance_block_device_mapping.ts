import { EC2, InstanceLifecycle } from '@aws-sdk/client-ec2';
import { Volume as AWSVolume } from '@aws-sdk/client-ec2';
import { WaiterState } from '@aws-sdk/util-waiter';

import { AwsEc2Module } from '..';
import { AWS, crudBuilder2 } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { GeneralPurposeVolume, Instance, InstanceBlockDeviceMapping, VolumeState } from '../entity';

export class InstanceBlockDeviceMappingMapper extends MapperBase<InstanceBlockDeviceMapping> {
  module: AwsEc2Module;
  entity = InstanceBlockDeviceMapping;
  equals = (a: InstanceBlockDeviceMapping, b: InstanceBlockDeviceMapping) => {
    return Object.is(a.deviceName, b.deviceName) && Object.is(a.deleteOnTermination, b.deleteOnTermination);
  };

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

  detachVolumeInternal = crudBuilder2<EC2, 'detachVolume'>('detachVolume', VolumeId => ({ VolumeId }));

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

  cloud: Crud2<InstanceBlockDeviceMapping> = new Crud2({
    create: async (es: InstanceBlockDeviceMapping[], ctx: Context) => {
      const out: InstanceBlockDeviceMapping[] = [];
      for (const e of es) {
        // if we have no ids we cannot create
        if (!e.cloudInstanceId || !e.cloudVolumeId) continue;

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

        if (result) {
          const map: InstanceBlockDeviceMapping = {
            deviceName: e.deviceName,
            instanceId: e.instanceId,
            instance: instance,
            volumeId: e.volumeId,
            volume: volume,
            region: e.region,
            cloudInstanceId: instance.instanceId,
            cloudVolumeId: volume.volumeId,
            deleteOnTermination: e.deleteOnTermination,
          };
          out.push(map);
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      if (id) {
        console.log('i read by id');
        // decompose the id
        const { instanceId, volumeId, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;

        // check if we can find the instance in database
        console.log('i want to read');
        console.log(instanceId);
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
          console.log('mapping is');
          console.log(mapping);
          for (const map of mapping ?? []) {
            if (map.DeviceName && map.Ebs?.VolumeId == volumeId) {
              console.log('i match');
              const volume = await this.module.generalPurposeVolume.db.read(
                ctx,
                this.module.generalPurposeVolume.generateId({ volumeId: map.Ebs.VolumeId ?? '', region }),
              );
              console.log('volume is');
              console.log(volume);

              const res: InstanceBlockDeviceMapping = {
                instanceId: instance?.id ?? undefined,
                volumeId: volume?.id ?? undefined,
                instance: instance,
                volume: volume,
                deviceName: map.DeviceName,
                cloudInstanceId: instanceId,
                cloudVolumeId: volumeId,
                region: region,
                deleteOnTermination: map.Ebs.DeleteOnTermination ?? true,
              };
              console.log('i return');
              console.log(res);
              return res;
            }
          }
        }
      } else {
        console.log('i read all mappings');
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

              for (const map of mapping ?? []) {
                console.log('map is');
                console.log(map);
                if (map.DeviceName && map.Ebs?.VolumeId) {
                  const volume = await this.module.generalPurposeVolume.db.read(
                    ctx,
                    this.module.generalPurposeVolume.generateId({ volumeId: map.Ebs.VolumeId ?? '', region }),
                  );

                  const res: InstanceBlockDeviceMapping = {
                    instanceId: instance?.id ?? undefined,
                    instance: instance,
                    volumeId: volume?.id ?? undefined,
                    volume: volume,
                    deviceName: map.DeviceName,
                    cloudInstanceId: i.InstanceId,
                    cloudVolumeId: map.Ebs.VolumeId,
                    region: region,
                    deleteOnTermination: map.Ebs.DeleteOnTermination ?? true,
                  };
                  out.push(res);
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

        if (e.deleteOnTermination != cloudRecord.deleteOnTermination) {
          // we need to update the delete on termination for that specific device
          const mappings = await this.module.instance.getInstanceBlockDeviceMapping(
            client.ec2client,
            e.cloudInstanceId,
          );
          for (const map of mappings ?? []) {
            if (map.DeviceName == e.deviceName && map.Ebs?.VolumeId == e.cloudVolumeId)
              map.Ebs!.DeleteOnTermination = e.deleteOnTermination;
            console.log('i modify delete on termination');
            console.log(mappings);
            const result = await this.modifyBlockDeviceMapping(client.ec2client, e.cloudInstanceId, mappings);
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
        if (!e.cloudVolumeId) continue;

        // we need to detach the volume
        try {
          await this.detachVolume(client.ec2client, e.cloudVolumeId ?? '');
        } catch (_) {}
      }
    },
  });

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
