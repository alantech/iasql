import { InstanceBlockDeviceMapping as AWSInstanceBlockDeviceMapping } from '@aws-sdk/client-ec2';

import { AwsEc2Module } from '..';
import { AWS } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import { InstanceBlockDeviceMapping } from '../entity';

export class InstanceBlockDeviceMappingMapper extends MapperBase<InstanceBlockDeviceMapping> {
  module: AwsEc2Module;
  entity = InstanceBlockDeviceMapping;
  equals = (a: InstanceBlockDeviceMapping, b: InstanceBlockDeviceMapping) =>
    Object.is(a.deviceName, b.deviceName) &&
    Object.is(a.instance?.id, b.instance?.id) &&
    Object.is(a.volume?.id, b.volume?.id);

  async instanceBlockDeviceMappingMapper(
    vol: AWSInstanceBlockDeviceMapping,
    instance_id: number,
    region: string,
    ctx: Context,
  ) {
    const out = new InstanceBlockDeviceMapping();
    if (!vol.DeviceName) return undefined;
    out.instance_id = instance_id;
    out.deviceName = vol.DeviceName;

    // read id for the volume
    if (vol.Ebs?.VolumeId) {
      const volume =
        (await this.module.generalPurposeVolume.db.read(
          ctx,
          this.module.instance.generateId({ volumeId: vol.Ebs?.VolumeId, region }),
        )) ??
        (await this.module.generalPurposeVolume.cloud.read(
          ctx,
          this.module.instance.generateId({ volumeId: vol.Ebs?.VolumeId, region }),
        ));

      if (volume) out.volume_id = volume.id;
    } else out.volume_id = undefined;
    return out;
  }

  cloud: Crud2<InstanceBlockDeviceMapping> = new Crud2({
    create: async (es: InstanceBlockDeviceMapping[], ctx: Context) => {
      const out: InstanceBlockDeviceMapping[] = [];
      for (const e of es) {
        const region = e.instance?.region;
        const client = (await ctx.getAwsClient(region)) as AWS;

        // if instance is not created we are in the first step, no need to create anything
        if (!e.instance?.instanceId) continue;
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      if (!!id) {
        const { instanceId, volumeId, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;

        // check mapping for this instance
        const rawInstance = await this.module.instance.getInstance(client.ec2client, instanceId);

        // check for the instance with the given device name and volume id
        for (const map of rawInstance.BlockDeviceMapping ?? []) {
          const m = await this.instanceBlockDeviceMappingMapper(map, parseInt(instanceId, 10), region, ctx);
          if (m?.volume_id == parseInt(volumeId, 10)) return m;
        }
        return undefined;
      } else {
        const out: InstanceBlockDeviceMapping[] = [];
        const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawInstances = (await this.module.instance.getInstances(client.ec2client)) ?? [];
            for (const i of rawInstances) {
              // read the instance mapping
              const instance =
                (await this.module.instance.db.read(
                  ctx,
                  this.module.instance.generateId({ instanceId: i.InstanceId ?? '', region }),
                )) ??
                (await this.module.instance.cloud.read(
                  ctx,
                  this.module.instance.generateId({ instanceId: i.InstanceId ?? '', region }),
                ));

              // check for the instance with the given device name and volume id
              for (const map of i.BlockDeviceMappings ?? []) {
                const m = await this.instanceBlockDeviceMappingMapper(map, instance.id, instance.region, ctx);
                if (m) out.push(m);
              }
            }
          }),
        );
        console.log('mappins are');
        console.log(out);
        return out;
      }
    },
    update: async (es: InstanceBlockDeviceMapping[], ctx: Context) => {
      const out: InstanceBlockDeviceMapping[] = [];
      for (const e of es) {
      }
      return out;
    },
    delete: async (es: InstanceBlockDeviceMapping[], ctx: Context) => {},
  });

  constructor(module: AwsEc2Module) {
    super();
    this.module = module;
    super.init();
  }
}
