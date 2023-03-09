import {
  EC2,
  RunInstancesCommandInput,
  DescribeInstancesCommandInput,
  paginateDescribeInstances,
  Volume as AWSVolume,
  DescribeVolumesCommandInput,
  waitUntilInstanceTerminated,
} from '@aws-sdk/client-ec2';
import {
  Instance as AWSInstance,
  InstanceLifecycle,
  Tag as AWSTag,
  InstanceBlockDeviceMapping as AWSInstanceBlockDeviceMapping,
} from '@aws-sdk/client-ec2';
import { SSM } from '@aws-sdk/client-ssm';
import { createWaiter, WaiterOptions, WaiterState } from '@aws-sdk/util-waiter';

import { AwsEc2Module } from '..';
import { awsIamModule, awsSecurityGroupModule, awsVpcModule } from '../..';
import { AWS, crudBuilder, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { Context, Crud, MapperBase } from '../../interfaces';
import {
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
    if (instance.InstanceId) {
      const instanceObj = await this.module.instance.db.read(
        ctx,
        this.generateId({ instanceId: instance.InstanceId, region }),
      );

      if (instanceObj) {
        // volume mapping
        const vol: InstanceBlockDeviceMapping[] = [];
        for (const newMap of instance.BlockDeviceMappings ?? []) {
          if (newMap.DeviceName && newMap.Ebs?.VolumeId) {
            const volume = await this.module.generalPurposeVolume.db.read(
              ctx,
              this.module.generalPurposeVolume.generateId({ volumeId: newMap.Ebs.VolumeId ?? '', region }),
            );
            const entry = await this.module.instanceBlockDeviceMapping.instanceBlockDeviceMappingMapper(
              newMap,
              instanceObj,
              ctx,
            );
            if (entry) vol.push(entry);
          }
        }
        out.instanceBlockDeviceMappings = vol;
      }
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

  getParameter = crudBuilder<SSM, 'getParameter'>('getParameter', Name => ({ Name }));

  describeImages = crudBuilder<EC2, 'describeImages'>('describeImages', ImageIds => ({
    ImageIds,
  }));

  describeInstances = crudBuilder<EC2, 'describeInstances'>('describeInstances', InstanceIds => ({
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

  // given an instance reads the mapping from the associate AMI, match
  // it with the current mapped volumes and generate the final mapping
  async generateBlockDeviceMapping(
    ctx: Context,
    ami: string,
    instanceMaps: InstanceBlockDeviceMapping[],
    instance: Instance,
    encrypted: boolean,
  ) {
    // start reading the block device mapping from the image
    const client = await ctx.getAwsClient(instance.region);
    const amiImage = (await this.describeImages(client.ec2client, [ami]))?.Images?.pop();

    if (amiImage) {
      const imageMapping = amiImage.BlockDeviceMappings;

      // check if there is any mapped volume that doesn't exist on instance mapping, and error
      // or if there is any volume mapped that is not set as root
      for (const instanceMap of instanceMaps ?? []) {
        // try to find the device name on instance mapping
        const vol = imageMapping?.find(item => item.DeviceName === instanceMap.deviceName);
        if (!vol) throw new Error('Error mapping volume to a device that does not exist for the AMI');
        if (instanceMap.volumeId && !instanceMap.volume?.isRootDevice)
          throw new Error('Error mapping volume that is not root');
      }
      const region = instance.region;
      for (const imageMap of imageMapping ?? []) {
        // check if there is an associated volume for that instance, volume and device name
        const vol = instanceMaps?.find(item => item.deviceName === imageMap.DeviceName);
        if (!vol) {
          if (imageMap.Ebs) imageMap.Ebs.Encrypted = encrypted; // just modify the encrypted flag
          continue;
        }
        if (!vol.volumeId) {
          // if it set to null, we need to clear the device
          imageMap.Ebs = undefined;
          imageMap.NoDevice = '';
          continue;
        }
        if (vol.volume) {
          // map it to the ebs mapping
          if (!vol.volume.isRootDevice) throw new Error('Error mapping volume that is not root');

          let snapshotId;
          if (vol.volume.snapshotId && instance.region === vol.region) snapshotId = vol.volume.snapshotId;
          else snapshotId = imageMap.Ebs?.SnapshotId;
          imageMap.Ebs = {
            DeleteOnTermination: vol.deleteOnTermination,
            Iops: vol.volume.volumeType !== GeneralPurposeVolumeType.GP2 ? vol.volume.iops : undefined,
            SnapshotId: snapshotId,
            VolumeSize: vol.volume.size,
            VolumeType: vol.volume.volumeType,
            KmsKeyId: imageMap.Ebs?.KmsKeyId,
            Throughput: vol.volume.throughput,
            OutpostArn: imageMap.Ebs?.OutpostArn,
            Encrypted: encrypted,
          };
        } else throw new Error('Could not find related volume data');
      }
      return imageMapping;
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

  cloud: Crud<Instance> = new Crud({
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

          const sgIds = instance.securityGroups.map(sg => sg.groupId).filter(id => !!id) as string[];

          const userData = instance.userData ? Buffer.from(instance.userData).toString('base64') : undefined;
          const iamInstanceProfile = instance.role?.arn
            ? { Arn: instance.role.arn.replace(':role/', ':instance-profile/') }
            : undefined;
          if (instance.subnet && !instance.subnet.subnetId) {
            throw new Error('Subnet assigned but not created yet in AWS');
          }

          // query for old instance maps and store them to remove later
          const opts = {
            where: {
              instanceId: instance.id,
            },
          };
          const maps: InstanceBlockDeviceMapping[] = await ctx.orm.find(InstanceBlockDeviceMapping, opts);

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

          const mappings = await this.generateBlockDeviceMapping(
            ctx,
            amiId!,
            maps ?? [],
            instance,
            instance.hibernationEnabled,
          );
          if (mappings) instanceParams.BlockDeviceMappings = mappings;

          const instanceId = await this.newInstance(client.ec2client, instanceParams);
          if (!instanceId) {
            // then who?
            throw new Error('should not be possible');
          }

          // deletes the volumes set as nodevice
          const oldMaps: InstanceBlockDeviceMapping[] = await ctx.orm.find(InstanceBlockDeviceMapping, opts);
          for (const oldMap of oldMaps ?? []) {
            if (!oldMap.volumeId) {
              await ctx.orm.remove(InstanceBlockDeviceMapping, oldMap);

              // force db cache cleanup
              delete ctx.memo.db.InstanceBlockDeviceMapping[
                this.module.instanceBlockDeviceMapping.entityId(oldMap)
              ];
            }
          }

          // reads the current mapping for the instance to get all the related volumes, and waits for them to be in use
          // as those volumes are created automatically by ec2 we need to wait for them and create those
          // in the database from our side
          const mapping = await this.getInstanceBlockDeviceMapping(client.ec2client, instanceId);
          for (const map of mapping ?? []) {
            if (map.DeviceName && map.Ebs?.VolumeId) {
              await this.module.instanceBlockDeviceMapping.waitUntilInUse(
                client.ec2client,
                map.Ebs.VolumeId!,
              );

              // if we had a root volume associated with the instance, we need to update the volume id
              const vol = maps?.find(item => item.deviceName === map.DeviceName);
              if (vol && vol.volumeId) {
                const volId = this.module.generalPurposeVolume.generateId({
                  volumeId: map.Ebs.VolumeId,
                  region: instance.region,
                });
                const volFromCloud = await this.module.generalPurposeVolume.cloud.read(ctx, volId);
                if (volFromCloud) {
                  volFromCloud.id = vol.volumeId;
                  volFromCloud.isRootDevice = false;
                  await this.module.generalPurposeVolume.db.update(volFromCloud, ctx);
                }
              } else {
                // we need to create it
                const volId = this.module.generalPurposeVolume.generateId({
                  volumeId: map.Ebs.VolumeId,
                  region: instance.region,
                });
                const volFromCloud = await this.module.generalPurposeVolume.cloud.read(ctx, volId);
                await this.module.generalPurposeVolume.db.create(volFromCloud, ctx);

                // find in the id
                const volFromDb = await this.module.generalPurposeVolume.db.read(ctx, volId);

                // create the block device mapping
                if (volFromDb) {
                  const newMap: InstanceBlockDeviceMapping = {
                    deviceName: map.DeviceName,
                    instanceId: instance.id,
                    instance,
                    volumeId: volFromDb.id,
                    volume: volFromDb,
                    region: instance.region,
                    deleteOnTermination: map.Ebs.DeleteOnTermination ?? true,
                  };
                  await this.module.instanceBlockDeviceMapping.db.create(newMap, ctx);
                }
              }
            }
          }

          const newEntity = await this.module.instance.cloud.read(
            ctx,
            this.module.instance.generateId({ instanceId, region: instance.region }),
          );

          newEntity.id = instance.id;
          await this.module.instance.db.update(newEntity, ctx);
          out.push(newEntity);
        }
      }
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
    updateOrReplace: (a: Instance, b: Instance) =>
      this.instanceEqReplaceableFields(a, b) ? 'update' : 'replace',
    update: async (es: Instance[], ctx: Context) => {
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
          await this.module.instance.cloud.delete(cloudRecord, ctx);

          // check if we have mappings and delete them - as it comes from an update, no cascade is deleting the mapping
          const opts = {
            where: {
              instanceId: e.id,
            },
          };
          const oldMaps: InstanceBlockDeviceMapping[] = await ctx.orm.find(InstanceBlockDeviceMapping, opts);
          for (const oldMap of oldMaps ?? []) {
            await ctx.orm.remove(InstanceBlockDeviceMapping, oldMap);

            // force db cache cleanup
            delete ctx.memo.db.InstanceBlockDeviceMapping[
              this.module.instanceBlockDeviceMapping.entityId(oldMap)
            ];
          }

          const created = (await this.module.instance.cloud.create(e, ctx)) as Instance;
          // TODO: Remove this weirdness once the `iasql_commit` logic can handle nested entity changes
          delete ctx?.memo?.db?.RegisteredInstance;
          const registeredInstances = await this.module.registeredInstance.db.read(ctx);
          for (const re of registeredInstances) {
            if (re.instance.instanceId === created.instanceId) {
              await this.module.registeredInstance.cloud.create(re, ctx);
            }
          }
          for (const k of Object.keys(ctx?.memo?.cloud?.RegisteredInstance ?? {})) {
            if (k.split('|')[0] === cloudRecord.instanceId) {
              const re = ctx.memo.cloud.RegisteredInstance[k];
              await this.module.registeredInstance.cloud.delete(re, ctx);
            }
          }
          await this.module.instance.cloud.delete(cloudRecord, ctx);
          out.push(created);
        }
      }
      return out;
    },
    delete: async (es: Instance[], ctx: Context) => {
      for (const entity of es) {
        if (!entity.instanceId) continue;
        const client = (await ctx.getAwsClient(entity.region)) as AWS;

        // read the maps before terminating
        const maps = await this.getInstanceBlockDeviceMapping(client.ec2client, entity.instanceId);

        await this.terminateInstance(client.ec2client, entity.instanceId);
        const result = await waitUntilInstanceTerminated(
          {
            client: client.ec2client,
            // all in seconds
            maxWaitTime: 900,
            minDelay: 1,
            maxDelay: 4,
          } as WaiterOptions<EC2>,
          { InstanceIds: [entity.instanceId] },
        );
        if (result.state !== WaiterState.SUCCESS) continue; // we keep trying until it is terminated

        // read the attached volumes and wait until terminated
        const region = entity.region;
        for (const map of maps ?? []) {
          // find related volume
          if (map.DeviceName && map.Ebs?.VolumeId) {
            // delete volume if needed
            const volId = this.module.generalPurposeVolume.generateId({
              volumeId: map.Ebs.VolumeId,
              region,
            });
            const volObj = await this.module.generalPurposeVolume.db.read(ctx, volId);

            // check if volume will be removed on termination
            if (volObj && map.Ebs.DeleteOnTermination) {
              const mapObj: InstanceBlockDeviceMapping = await ctx.orm.findOne(InstanceBlockDeviceMapping, {
                where: {
                  volumeId: volObj.id,
                },
              });
              if (mapObj) {
                await ctx.orm.remove(InstanceBlockDeviceMapping, mapObj);
                if (mapObj.instance.instanceId && mapObj.volume?.volumeId) {
                  const mapId = this.module.instanceBlockDeviceMapping.entityId(mapObj);
                  if (mapId) delete ctx.memo.db.InstanceBlockDeviceMapping[mapId];
                }
              }
              await this.module.generalPurposeVolume.db.delete(volObj, ctx);
              if (volObj.cloudVolumeId) {
                const volGenId = this.module.generalPurposeVolume.entityId(volObj);
                if (volGenId) delete ctx.memo.db.GeneralPurposeVolume[volGenId];
              }
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
