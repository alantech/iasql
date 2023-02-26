import {
  EC2,
  RunInstancesCommandInput,
  DescribeInstancesCommandInput,
  paginateDescribeInstances,
  Volume as AWSVolume,
  DescribeVolumesCommandInput,
} from '@aws-sdk/client-ec2';
import {
  Instance as AWSInstance,
  InstanceLifecycle,
  Tag as AWSTag,
  InstanceBlockDeviceMapping as AWSInstanceBlockDeviceMapping,
} from '@aws-sdk/client-ec2';
import { SSM } from '@aws-sdk/client-ssm';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { AwsEc2Module } from '..';
import { awsIamModule, awsSecurityGroupModule, awsVpcModule } from '../..';
import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud2, MapperBase } from '../../interfaces';
import {
  GeneralPurposeVolume,
  GeneralPurposeVolumeType,
  Instance,
  InstanceBlockDeviceMapping,
  State,
  VolumeState,
} from '../entity';
import { updateTags, eqTags } from './tags';

export class InstanceMapper extends MapperBase<Instance> {
  module: AwsEc2Module;
  entity = Instance;
  equals = (a: Instance, b: Instance) =>
    Object.is(a.state, b.state) && this.instanceEqReplaceableFields(a, b) && eqTags(a.tags, b.tags);

  instanceEqReplaceableFields(a: Instance, b: Instance) {
    return (
      Object.is(a.instanceId, b.instanceId) &&
      Object.is(a.instanceType, b.instanceType) &&
      Object.is(a.userData, b.userData) &&
      Object.is(a.keyPairName, b.keyPairName) &&
      Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
      a.securityGroups?.every(as => !!b.securityGroups?.find(bs => Object.is(as.groupId, bs.groupId))) &&
      Object.is(a.role?.arn, b.role?.arn) &&
      Object.is(a.subnet?.subnetId, b.subnet?.subnetId) &&
      Object.is(a.hibernationEnabled, b.hibernationEnabled)
    );
  }

  async instanceMapper(instance: AWSInstance, region: string, ctx: Context) {
    const client = (await ctx.getAwsClient(region)) as AWS;
    const out = new Instance();
    if (!instance.InstanceId) return undefined;
    out.instanceId = instance.InstanceId;
    const tags: { [key: string]: string } = {};
    (instance.Tags || [])
      .filter(t => !!t.Key && !!t.Value)
      .forEach(t => {
        tags[t.Key as string] = t.Value as string;
      });
    out.tags = tags;
    const userDataBase64 = await this.getInstanceUserData(client.ec2client, out.instanceId);
    out.userData = userDataBase64 ? Buffer.from(userDataBase64, 'base64').toString('ascii') : undefined;
    if (instance.State?.Name === State.STOPPED) out.state = State.STOPPED;
    // map interim states to running
    else out.state = State.RUNNING;
    out.ami = instance.ImageId ?? '';
    if (instance.KeyName) out.keyPairName = instance.KeyName;
    out.instanceType = instance.InstanceType ?? '';
    if (!out.instanceType) return undefined;
    out.securityGroups = [];
    for (const sgId of instance.SecurityGroups?.map(sg => sg.GroupId) ?? []) {
      const sg = await awsSecurityGroupModule.securityGroup.db.read(
        ctx,
        awsSecurityGroupModule.securityGroup.generateId({ groupId: sgId ?? '', region }),
      );
      if (sg) out.securityGroups.push(sg);
    }
    if (instance.IamInstanceProfile?.Arn) {
      const roleName = awsIamModule.role.roleNameFromArn(instance.IamInstanceProfile.Arn, ctx);
      try {
        const role =
          (await awsIamModule.role.db.read(ctx, roleName)) ??
          (await awsIamModule.role.cloud.read(ctx, roleName));
        if (role) {
          out.role = role;
        }
      } catch (_) {
        /** Do nothing */
      }
    }
    out.subnet =
      (await awsVpcModule.subnet.db.read(
        ctx,
        awsVpcModule.subnet.generateId({ subnetId: instance.SubnetId ?? '', region }),
      )) ??
      (await awsVpcModule.subnet.cloud.read(
        ctx,
        awsVpcModule.subnet.generateId({ subnetId: instance.SubnetId ?? '', region }),
      ));
    out.hibernationEnabled = instance.HibernationOptions?.Configured ?? false;
    out.region = region;

    // check if we can find the instance in database
    console.log('i read instance from cloud');
    console.log('instance id is');
    console.log(instance.InstanceId);
    const instanceObj = await this.module.instance.db.read(
      ctx,
      this.module.instance.generateId({ instanceId: instance.InstanceId ?? '', region }),
    );
    console.log(instanceObj);

    if (instanceObj) {
      // volume mapping
      const vol: InstanceBlockDeviceMapping[] = [];
      for (const map of instance.BlockDeviceMappings ?? []) {
        if (map.DeviceName && map.Ebs?.VolumeId) {
          const volume = await this.module.generalPurposeVolume.db.read(
            ctx,
            this.module.generalPurposeVolume.generateId({ volumeId: map.Ebs.VolumeId ?? '', region }),
          );
          console.log('volume is');
          console.log(volume);

          const entry: InstanceBlockDeviceMapping = {
            instance: instanceObj,
            volume: volume,
            instanceId: instanceObj?.id ?? undefined,
            volumeId: volume?.id ?? undefined,
            deviceName: map.DeviceName,
            cloudInstanceId: instance.InstanceId,
            cloudVolumeId: map.Ebs.VolumeId,
            region: region,
            deleteOnTermination: map.Ebs.DeleteOnTermination ?? true,
          };
          vol.push(entry);
        }
      }
      out.instanceBlockDeviceMappings = vol;
    }

    return out;
  }

  getInstanceUserData = crudBuilderFormat<EC2, 'describeInstanceAttribute', string | undefined>(
    'describeInstanceAttribute',
    InstanceId => ({ Attribute: 'userData', InstanceId }),
    res => res?.UserData?.Value,
  );

  getInstanceBlockDeviceMapping = crudBuilderFormat<
    EC2,
    'describeInstanceAttribute',
    AWSInstanceBlockDeviceMapping[] | undefined
  >(
    'describeInstanceAttribute',
    InstanceId => ({ Attribute: 'blockDeviceMapping', InstanceId }),
    res => res?.BlockDeviceMappings,
  );

  getVolumesByInstanceId = crudBuilderFormat<EC2, 'describeVolumes', AWSVolume[] | undefined>(
    'describeVolumes',
    instanceId => ({
      Filters: [
        {
          Name: 'attachment.instance-id',
          Values: [instanceId],
        },
      ],
    }),
    res => res?.Volumes,
  );

  getParameter = crudBuilder2<SSM, 'getParameter'>('getParameter', Name => ({ Name }));

  describeImages = crudBuilder2<EC2, 'describeImages'>('describeImages', ImageIds => ({
    ImageIds,
  }));

  describeInstances = crudBuilder2<EC2, 'describeInstances'>('describeInstances', InstanceIds => ({
    InstanceIds,
  }));

  async getInstance(client: EC2, id: string) {
    const reservations = await this.describeInstances(client, [id]);
    return (reservations?.Reservations?.map((r: any) => r.Instances) ?? []).pop()?.pop();
  }

  getInstances = paginateBuilder<EC2>(paginateDescribeInstances, 'Instances', 'Reservations');

  // TODO: Macro-ify the waiter usage
  async newInstance(client: EC2, newInstancesInput: RunInstancesCommandInput): Promise<string> {
    const create = await client.runInstances(newInstancesInput);
    const instanceIds: string[] | undefined = create.Instances?.map(i => i?.InstanceId ?? '');
    const input: DescribeInstancesCommandInput = {
      InstanceIds: instanceIds,
    };
    // TODO: should we use the paginator instead?
    await createWaiter<EC2, DescribeInstancesCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (cl, cmd) => {
        try {
          const data = await cl.describeInstances(cmd);
          for (const reservation of data?.Reservations ?? []) {
            for (const instance of reservation?.Instances ?? []) {
              if (instance.PublicIpAddress === undefined || instance.State?.Name !== 'running')
                return { state: WaiterState.RETRY };
            }
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.Code === 'InvalidInstanceID.NotFound') return { state: WaiterState.RETRY };
          throw e;
        }
      },
    );
    return instanceIds?.pop() ?? '';
  }

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

  waitUntilDeleted(client: EC2, volumeId: string) {
    return this.volumeWaiter(client, volumeId, (vol: AWSVolume | undefined) => {
      // If state is not 'in-use' retry
      if (!Object.is(vol?.State, VolumeState.DELETED)) {
        return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    });
  }

  // TODO: More to fix
  async startInstance(client: EC2, instanceId: string) {
    await client.startInstances({
      InstanceIds: [instanceId],
    });
    const input: DescribeInstancesCommandInput = {
      InstanceIds: [instanceId],
    };
    await createWaiter<EC2, DescribeInstancesCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (cl, cmd) => {
        try {
          const data = await cl.describeInstances(cmd);
          for (const reservation of data?.Reservations ?? []) {
            for (const instance of reservation?.Instances ?? []) {
              if (instance.State?.Name !== 'running') return { state: WaiterState.RETRY };
            }
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.Code === 'InvalidInstanceID.NotFound') return { state: WaiterState.SUCCESS };
          throw e;
        }
      },
    );
  }

  // TODO: Macro-ify this
  async stopInstance(client: EC2, instanceId: string, hibernate = false) {
    await client.stopInstances({
      InstanceIds: [instanceId],
      Hibernate: hibernate,
    });
    const input: DescribeInstancesCommandInput = {
      InstanceIds: [instanceId],
    };
    await createWaiter<EC2, DescribeInstancesCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 300,
        minDelay: 1,
        maxDelay: 4,
      },
      input,
      async (cl, cmd) => {
        try {
          const data = await cl.describeInstances(cmd);
          for (const reservation of data?.Reservations ?? []) {
            for (const instance of reservation?.Instances ?? []) {
              if (instance.State?.Name !== 'stopped') return { state: WaiterState.RETRY };
            }
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.Code === 'InvalidInstanceID.NotFound') return { state: WaiterState.SUCCESS };
          throw e;
        }
      },
    );
  }

  terminateInstance = crudBuilderFormat<EC2, 'terminateInstances', undefined>(
    'terminateInstances',
    id => ({ InstanceIds: [id] }),
    _res => undefined,
  );

  // given an instance reads the mapping from the associate AMI , match
  // it with the current mapped volumes and generate the final mapping
  async generateBlockDeviceMapping(ctx: Context, ami: string, instance: Instance, encrypted: boolean) {
    // start reading the block device mapping from the image
    const client = await ctx.getAwsClient(instance.region);
    const amiImage = (await this.describeImages(client.ec2client, [ami]))?.Images?.pop();

    if (amiImage) {
      const mapping = amiImage.BlockDeviceMappings;

      // a new created instance still does not have mapping, we need to search for one
      const opts = {
        where: {
          instanceId: instance.id,
        },
      };
      const maps: InstanceBlockDeviceMapping[] = await ctx.orm.find(InstanceBlockDeviceMapping, opts);

      // check if there is any mapped volume that doesn't exist on instance mapping, and error
      for (const dev of maps ?? []) {
        console.log('i found');
        console.log(dev);
        // try to find the device name on instance mapping
        const vol = mapping?.find(item => item.DeviceName == dev.deviceName);
        if (!vol) throw new Error('Error mapping volume to a device that does not exist for the AMI');
      }
      const region = instance.region;
      for (const map of mapping ?? []) {
        console.log('i check map');
        console.log(map);
        // check if there is an associated volume for that instance, volume and device name
        const vol = maps?.find(item => item.deviceName == map.DeviceName);
        if (vol) {
          console.log('i found');
          console.log(vol);

          if (vol.volumeId) {
            // need to find the volume object
            const volObj = await ctx.orm.findOne(GeneralPurposeVolume, vol.volumeId);
            console.log('obj is');
            console.log(volObj);
            if (volObj) {
              // check that are on the same AZ
              if (volObj.availabilityZone.name != instance.subnet?.availabilityZone.name)
                throw new Error('Volume and instance must be on the same availability zone');
              // map it to the ebs mapping
              map.Ebs = {
                DeleteOnTermination: vol.deleteOnTermination,
                Iops: volObj.volumeType != GeneralPurposeVolumeType.GP2 ? volObj.iops : undefined,
                SnapshotId: (volObj.snapshotId ?? '').length > 0 ? volObj.snapshotId : map.Ebs?.SnapshotId,
                VolumeSize: volObj.size,
                VolumeType: volObj.volumeType,
                KmsKeyId: map.Ebs?.KmsKeyId,
                Throughput: volObj.throughput,
                OutpostArn: map.Ebs?.OutpostArn,
                Encrypted: encrypted,
              };
            } else {
              throw new Error('Could not find related volume data');
            }
          } else {
            console.log('no device');
            // if it set to null, we need to clear the device
            map.Ebs = undefined;
            map.NoDevice = '';
          }
        } else {
          console.log('default is');
          console.log(map.Ebs);
          if (map.Ebs) map.Ebs.Encrypted = encrypted; // just modify the encrypted flag
        }
      }
      console.log(mapping);
      return mapping;
    } else throw new Error('Could not find instance image');
  }

  async generateAmiId(client: AWS, ami: string) {
    let amiId;
    // Resolve amiId if necessary
    if (ami.includes('resolve:ssm:')) {
      const amiPath = ami.split('resolve:ssm:').pop() ?? '';
      const ssmParameter = await this.getParameter(client.ssmClient, amiPath);
      amiId = ssmParameter?.Parameter?.Value;
    } else {
      amiId = ami;
    }
    return amiId;
  }

  cloud: Crud2<Instance> = new Crud2({
    create: async (es: Instance[], ctx: Context) => {
      const out = [];
      for (const instance of es) {
        const client = (await ctx.getAwsClient(instance.region)) as AWS;
        const previousInstanceId = instance.instanceId;
        if (instance.ami) {
          let tgs: AWSTag[] = [];
          if (instance.tags !== undefined) {
            const tags: { [key: string]: string } = instance.tags;
            tags.owner = 'iasql-engine';
            tgs = Object.keys(tags).map(k => {
              return {
                Key: k,
                Value: tags[k],
              };
            });
          }

          // check if we have some entry without security group id
          const without = instance.securityGroups.filter(sg => !sg.groupId);
          if (without.length > 0) continue;
          console.log('after security groups');

          const sgIds = instance.securityGroups.map(sg => sg.groupId).filter(id => !!id) as string[];

          const userData = instance.userData ? Buffer.from(instance.userData).toString('base64') : undefined;
          const iamInstanceProfile = instance.role?.arn
            ? { Arn: instance.role.arn.replace(':role/', ':instance-profile/') }
            : undefined;
          if (instance.subnet && !instance.subnet.subnetId) {
            throw new Error('Subnet assigned but not created yet in AWS');
          }

          // if there are previous volumes, we delete it as the instance will recreate it
          const opts = {
            where: {
              instanceId: instance.id,
            },
          };
          const maps: InstanceBlockDeviceMapping[] = await ctx.orm.find(InstanceBlockDeviceMapping, opts);
          console.log(maps);

          for (const map of maps ?? []) {
            console.log('i have previous map');
            const region = instance.region;

            // try to find volume and delete from db and cloud
            if (map.deviceName && map.volumeId && map.volume) {
              console.log('i read volume from db');
              const volumeObj: GeneralPurposeVolume = await ctx.orm.findOne(GeneralPurposeVolume, {
                id: map.volumeId,
              });
              if (volumeObj) {
                console.log('i have');
                console.log(volumeObj);
                // delete from cloud
                await this.module.generalPurposeVolume.cloud.delete(volumeObj, ctx);
              }
              await this.module.instanceBlockDeviceMapping.db.delete(map, ctx);
              await this.module.generalPurposeVolume.db.delete(map.volume, ctx);
            }
          }

          const instanceParams: RunInstancesCommandInput = {
            ImageId: instance.ami,
            InstanceType: instance.instanceType,
            MinCount: 1,
            MaxCount: 1,
            TagSpecifications: [
              {
                ResourceType: 'instance',
                Tags: tgs,
              },
            ],
            KeyName: instance.keyPairName,
            UserData: userData,
            IamInstanceProfile: iamInstanceProfile,
            SubnetId: instance.subnet?.subnetId,
          };
          // Add security groups if any
          if (sgIds?.length) instanceParams.SecurityGroupIds = sgIds;
          const amiId = await this.generateAmiId(client, instance.ami);

          if (instance.hibernationEnabled) {
            // Update input object
            instanceParams.HibernationOptions = {
              Configured: true,
            };
          }

          // get block device mapping parameter
          const mappings = await this.generateBlockDeviceMapping(
            ctx,
            amiId!,
            instance,
            instance.hibernationEnabled,
          );
          if (mappings) instanceParams.BlockDeviceMappings = mappings;
          console.log('mappings are');
          console.log(mappings);

          const instanceId = await this.newInstance(client.ec2client, instanceParams);
          if (!instanceId) {
            // then who?
            throw new Error('should not be possible');
          }

          // read block device mapping from instance and wait for volumes in use
          console.log('in create block device mapping');
          const mapping = await this.getInstanceBlockDeviceMapping(client.ec2client, instanceId);
          for (const map of mapping ?? []) {
            console.log('i have map');
            console.log(map);
            if (map.DeviceName && map.Ebs?.VolumeId) {
              console.log('i wait for');
              console.log(map.Ebs.VolumeId);
              await this.module.instanceBlockDeviceMapping.waitUntilInUse(
                client.ec2client,
                map.Ebs.VolumeId!,
              );

              // if it does not exist, create on the db
              const region = instance.region;
              const volId = this.module.generalPurposeVolume.generateId({
                volumeId: map.Ebs.VolumeId,
                region,
              });
              const volDb = await this.module.generalPurposeVolume.db.read(ctx, volId);
              if (!volDb) {
                console.log('i create');
                const volFromCloud = await this.module.generalPurposeVolume.cloud.read(ctx, volId);
                await this.module.generalPurposeVolume.db.create(volFromCloud, ctx);

                // find in the id
                const volFromDb = await this.module.generalPurposeVolume.db.read(ctx, volId);
                console.log('i created volume');
                console.log(volFromDb);

                // create the block device mapping
                if (volFromDb) {
                  console.log('i need to add the mapping');
                  const newMap: InstanceBlockDeviceMapping = {
                    deviceName: map.DeviceName,
                    instanceId: instance.id,
                    instance: instance,
                    cloudInstanceId: instanceId,
                    volumeId: volFromDb.id,
                    volume: volFromDb,
                    cloudVolumeId: map.Ebs.VolumeId,
                    region: region,
                    deleteOnTermination: map.Ebs.DeleteOnTermination ?? true,
                  };
                  console.log(newMap);
                  await this.module.instanceBlockDeviceMapping.db.create(newMap, ctx);
                }
              }
            }
          }

          const newEntity = await this.module.instance.cloud.read(
            ctx,
            this.module.instance.generateId({ instanceId, region: instance.region }),
          );
          console.log('after new entity');
          console.log(newEntity);

          try {
            newEntity.id = instance.id;
            await this.module.instance.db.update(newEntity, ctx);
            console.log('i created');
            console.log(newEntity);
          } catch (e) {
            console.log('error updating entity');
            console.log(e);
          }

          out.push(newEntity);
        }
      }
      console.log('vms are');
      console.log(out);
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      if (id) {
        const { instanceId, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const rawInstance = await this.getInstance(client.ec2client, instanceId);
        // exclude spot instances
        if (!rawInstance || rawInstance.InstanceLifecycle === InstanceLifecycle.SPOT) return;
        if (rawInstance.State?.Name === 'terminated' || rawInstance.State?.Name === 'shutting-down') return;
        return this.instanceMapper(rawInstance, region, ctx);
      } else {
        const out: Instance[] = [];
        const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawInstances = (await this.getInstances(client.ec2client)) ?? [];
            for (const i of rawInstances) {
              if (i?.State?.Name === 'terminated' || i?.State?.Name === 'shutting-down') continue;
              const outInst = await this.instanceMapper(i, region, ctx);
              if (outInst) out.push(outInst);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (_a: Instance, _b: Instance) => 'replace',
    update: async (es: Instance[], ctx: Context) => {
      console.log('i need to update instance');
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.Instance?.[this.entityId(e)];
        if (this.instanceEqReplaceableFields(e, cloudRecord)) {
          const insId = e.instanceId as string;
          if (!eqTags(e.tags, cloudRecord.tags) && e.instanceId && e.tags) {
            await updateTags(client.ec2client, insId, e.tags);
          }
          if (!Object.is(e.state, cloudRecord.state) && e.instanceId) {
            if (cloudRecord.state === State.STOPPED && e.state === State.RUNNING) {
              await this.startInstance(client.ec2client, insId);
            } else if (cloudRecord.state === State.RUNNING && e.state === State.STOPPED) {
              await this.stopInstance(client.ec2client, insId);
            } else if (cloudRecord.state === State.RUNNING && e.state === State.HIBERNATE) {
              await this.stopInstance(client.ec2client, insId, true);
              e.state = State.STOPPED;
              await this.module.instance.db.update(e, ctx);
            } else {
              // TODO: This throw will interrupt the other EC2 updates. Is that alright?
              throw new Error(
                `Invalid instance state transition. From CLOUD state ${cloudRecord.state} to DB state ${e.state}`,
              );
            }
          }
          out.push(e);
        } else {
          // need to delete previous instance before so block device mapping gets cleared
          await this.module.instance.cloud.delete(cloudRecord, ctx);
          const created = await this.module.instance.cloud.create(e, ctx);
          if (!!created && created instanceof Array) {
            out.push(...created);
          } else if (!!created) {
            out.push(created);
          }
        }
      }
      return out;
    },
    delete: async (es: Instance[], ctx: Context) => {
      for (const entity of es) {
        console.log('in delete');
        console.log(entity);
        if (!entity.instanceId) continue;
        const client = (await ctx.getAwsClient(entity.region)) as AWS;

        // read the maps before terminating
        const maps = await this.getInstanceBlockDeviceMapping(client.ec2client, entity.instanceId);
        console.log('i have mapping');
        console.log(maps);

        await this.terminateInstance(client.ec2client, entity.instanceId);
        const region = entity.region;

        // read the attached volumes and wait until terminated
        for (const map of maps ?? []) {
          // find related volume
          console.log(map);
          if (map.DeviceName && map.Ebs?.VolumeId) {
            // delete volume if needed
            const volId = this.module.generalPurposeVolume.generateId({
              volumeId: map.Ebs.VolumeId,
              region,
            });
            console.log('vol id is');
            console.log(volId);

            const volObj =
              (await this.module.generalPurposeVolume.cloud.read(ctx, volId)) ??
              (await this.module.generalPurposeVolume.db.read(ctx, volId));
            console.log('obj is');
            console.log(volObj);

            // check if volume will be removed on termination
            if (map.Ebs.DeleteOnTermination) {
              console.log('i wait until terminated');
              await this.waitUntilDeleted(client.ec2client, map.Ebs.VolumeId);
              await this.module.generalPurposeVolume.db.delete(volObj, ctx);
              console.log('after');
            }
          }
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
