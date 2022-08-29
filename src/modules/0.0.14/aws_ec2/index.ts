import {
  Instance as AWSInstance,
  InstanceLifecycle,
  RunInstancesCommandInput,
  Tag as AWSTag,
  Volume as AWSVolume,
  CreateVolumeCommandInput,
  ModifyVolumeCommandInput,
} from '@aws-sdk/client-ec2';

import { Context, Crud2, Mapper2, Module2 } from '../../interfaces';
import { AwsElbModule } from '../aws_elb';
import { AwsIamModule } from '../aws_iam';
import { AwsSecurityGroupModule } from '../aws_security_group';
import { AwsVpcModule } from '../aws_vpc';
import {
  AWS,
  attachVolume,
  createVolume,
  deleteVolume,
  detachVolume,
  getGeneralPurposeVolumes,
  getVolume,
  getVolumesByInstanceId,
  updateVolume,
  waitUntilDeleted,
  waitUntilInUse,
  getInstanceUserData,
  newInstance,
  getInstance,
  getInstances,
  updateTags,
  startInstance,
  stopInstance,
  terminateInstance,
  registerInstance,
  getRegisteredInstance,
  getRegisteredInstances,
  deregisterInstance,
  describeImages,
  getParameter,
} from './aws';
import {
  GeneralPurposeVolume,
  GeneralPurposeVolumeType,
  Instance,
  RegisteredInstance,
  State,
  VolumeState,
} from './entity';
import * as metadata from './module.json';

export const AwsEc2Module: Module2 = new Module2(
  {
    ...metadata,
    utils: {
      instanceMapper: async (instance: AWSInstance, ctx: Context) => {
        const client = (await ctx.getAwsClient()) as AWS;
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
        const userDataBase64 = await getInstanceUserData(client.ec2client, out.instanceId);
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
          const sg = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sgId);
          if (sg) out.securityGroups.push(sg);
        }
        if (instance.IamInstanceProfile?.Arn) {
          const roleName = AwsIamModule.utils.roleNameFromArn(instance.IamInstanceProfile.Arn);
          try {
            const role =
              (await AwsIamModule.mappers.role.db.read(ctx, roleName)) ??
              (await AwsIamModule.mappers.role.cloud.read(ctx, roleName));
            if (role) {
              out.role = role;
            }
          } catch (_) {
            /** Do nothing */
          }
        }
        out.subnet =
          (await AwsVpcModule.mappers.subnet.db.read(ctx, instance.SubnetId)) ??
          (await AwsVpcModule.mappers.subnet.cloud.read(ctx, instance.SubnetId));
        out.hibernationEnabled = instance.HibernationOptions?.Configured ?? false;
        return out;
      },
      instanceEqReplaceableFields: (a: Instance, b: Instance) =>
        Object.is(a.instanceId, b.instanceId) &&
        Object.is(a.ami, b.ami) &&
        Object.is(a.instanceType, b.instanceType) &&
        Object.is(a.userData, b.userData) &&
        Object.is(a.keyPairName, b.keyPairName) &&
        Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
        a.securityGroups?.every(as => !!b.securityGroups?.find(bs => Object.is(as.groupId, bs.groupId))) &&
        Object.is(a.role?.arn, b.role?.arn) &&
        Object.is(a.subnet?.subnetId, b.subnet?.subnetId) &&
        Object.is(a.hibernationEnabled, b.hibernationEnabled),
      eqTags: (a: { [key: string]: string }, b: { [key: string]: string }) =>
        Object.is(Object.keys(a ?? {})?.length, Object.keys(b ?? {})?.length) &&
        Object.keys(a ?? {})?.every(ak => (a ?? {})[ak] === (b ?? {})[ak]),
      registeredInstanceMapper: async (registeredInstance: { [key: string]: string }, ctx: Context) => {
        const out = new RegisteredInstance();
        out.instance =
          (await AwsEc2Module.mappers.instance.db.read(ctx, registeredInstance.instanceId)) ??
          (await AwsEc2Module.mappers.instance.cloud.read(ctx, registeredInstance.instanceId));
        out.targetGroup =
          (await AwsElbModule.mappers.targetGroup.db.read(ctx, registeredInstance.targetGroupArn)) ??
          (await AwsElbModule.mappers.targetGroup.cloud.read(ctx, registeredInstance.targetGroupArn));
        out.port = registeredInstance.port ? +registeredInstance.port : undefined;
        return out;
      },
      generalPurposeVolumeMapper: async (vol: AWSVolume, ctx: Context) => {
        const out = new GeneralPurposeVolume();
        if (!vol?.VolumeId) return undefined;
        out.volumeId = vol.VolumeId;
        out.volumeType = vol.VolumeType as GeneralPurposeVolumeType;
        out.availabilityZone =
          (await AwsVpcModule.mappers.availabilityZone.db.read(ctx, vol.AvailabilityZone)) ??
          (await AwsVpcModule.mappers.availabilityZone.cloud.read(ctx, vol.AvailabilityZone));
        out.size = vol.Size ?? 1;
        out.iops = vol.Iops;
        out.throughput = vol.Throughput;
        out.state = vol.State as VolumeState;
        out.snapshotId = vol.SnapshotId;
        if (vol.Attachments?.length) {
          const attachment = vol.Attachments.pop();
          out.attachedInstance =
            (await AwsEc2Module.mappers.instance.db.read(ctx, attachment?.InstanceId)) ??
            (await AwsEc2Module.mappers.instance.cloud.read(ctx, attachment?.InstanceId));
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
    },
    mappers: {
      instance: new Mapper2<Instance>({
        entity: Instance,
        equals: (a: Instance, b: Instance) =>
          Object.is(a.state, b.state) &&
          AwsEc2Module.utils.instanceEqReplaceableFields(a, b) &&
          AwsEc2Module.utils.eqTags(a.tags, b.tags),
        source: 'db',
        cloud: new Crud2({
          create: async (es: Instance[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const instance of es) {
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
                const sgIds = instance.securityGroups.map(sg => sg.groupId).filter(id => !!id) as string[];
                const userData = instance.userData
                  ? Buffer.from(instance.userData).toString('base64')
                  : undefined;
                const iamInstanceProfile = instance.role?.arn
                  ? { Arn: instance.role.arn.replace(':role/', ':instance-profile/') }
                  : undefined;
                if (instance.subnet && !instance.subnet.subnetId) {
                  throw new Error('Subnet assigned but not created yet in AWS');
                }
                const instanceParams: RunInstancesCommandInput = {
                  ImageId: instance.ami,
                  InstanceType: instance.instanceType,
                  MinCount: 1,
                  MaxCount: 1,
                  SecurityGroupIds: sgIds,
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
                if (instance.hibernationEnabled) {
                  let amiId;
                  // Resolve amiId if necessary
                  if (instance.ami.includes('resolve:ssm:')) {
                    const amiPath = instance.ami.split('resolve:ssm:').pop() ?? '';
                    const ssmParameter = await getParameter(client.ssmClient, amiPath);
                    amiId = ssmParameter?.Parameter?.Value;
                  } else {
                    amiId = instance.ami;
                  }
                  // Get AMI image
                  const amiImage = (await describeImages(client.ec2client, [amiId]))?.Images?.pop();
                  // Update input object
                  instanceParams.HibernationOptions = {
                    Configured: true,
                  };
                  instanceParams.BlockDeviceMappings = [
                    {
                      DeviceName: amiImage?.RootDeviceName,
                      Ebs: {
                        Encrypted: true,
                      },
                    },
                  ];
                }
                const instanceId = await newInstance(client.ec2client, instanceParams);
                if (!instanceId) {
                  // then who?
                  throw new Error('should not be possible');
                }
                const newEntity = await AwsEc2Module.mappers.instance.cloud.read(ctx, instanceId);
                newEntity.id = instance.id;
                await AwsEc2Module.mappers.instance.db.update(newEntity, ctx);
                out.push(newEntity);
                // Attach volume
                const rawAttachedVolume = (await getVolumesByInstanceId(client.ec2client, instanceId))?.pop();
                await waitUntilInUse(client.ec2client, rawAttachedVolume?.VolumeId ?? '');
                delete ctx?.memo?.cloud?.GeneralPurposeVolume?.[rawAttachedVolume?.VolumeId ?? ''];
                const attachedVolume: GeneralPurposeVolume =
                  await AwsEc2Module.mappers.generalPurposeVolume.cloud.read(
                    ctx,
                    rawAttachedVolume?.VolumeId ?? '',
                  );
                if (attachedVolume && !Array.isArray(attachedVolume)) {
                  attachedVolume.attachedInstance = newEntity;
                  // If this is a replace path, there could be already a root volume in db, we need to find it and delete it
                  // before creating the new one.
                  if (previousInstanceId) {
                    const rawPreviousInstance: AWSInstance = await getInstance(
                      client.ec2client,
                      previousInstanceId,
                    );
                    const dbAttachedVolume = await ctx.orm.findOne(GeneralPurposeVolume, {
                      where: {
                        attachedInstance: {
                          id: newEntity.id,
                        },
                        instanceDeviceName: rawPreviousInstance.RootDeviceName,
                      },
                      relations: ['attachedInstance'],
                    });
                    if (dbAttachedVolume)
                      await AwsEc2Module.mappers.generalPurposeVolume.db.delete(dbAttachedVolume, ctx);
                  }
                  await AwsEc2Module.mappers.generalPurposeVolume.db.create(attachedVolume, ctx);
                }
              }
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const rawInstance = await getInstance(client.ec2client, id);
              // exclude spot instances
              if (!rawInstance || rawInstance.InstanceLifecycle === InstanceLifecycle.SPOT) return;
              if (rawInstance.State?.Name === 'terminated' || rawInstance.State?.Name === 'shutting-down')
                return;
              return AwsEc2Module.utils.instanceMapper(rawInstance, ctx);
            } else {
              const rawInstances = (await getInstances(client.ec2client)) ?? [];
              const out = [];
              for (const i of rawInstances) {
                if (i?.State?.Name === 'terminated' || i?.State?.Name === 'shutting-down') continue;
                out.push(await AwsEc2Module.utils.instanceMapper(i, ctx));
              }
              return out;
            }
          },
          updateOrReplace: (_a: Instance, _b: Instance) => 'replace',
          update: async (es: Instance[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              const cloudRecord = ctx?.memo?.cloud?.Instance?.[e.instanceId ?? ''];
              if (AwsEc2Module.utils.instanceEqReplaceableFields(e, cloudRecord)) {
                const insId = e.instanceId as string;
                if (!AwsEc2Module.utils.eqTags(e.tags, cloudRecord.tags) && e.instanceId && e.tags) {
                  await updateTags(client.ec2client, insId, e.tags);
                }
                if (!Object.is(e.state, cloudRecord.state) && e.instanceId) {
                  if (cloudRecord.state === State.STOPPED && e.state === State.RUNNING) {
                    await startInstance(client.ec2client, insId);
                  } else if (cloudRecord.state === State.RUNNING && e.state === State.STOPPED) {
                    await stopInstance(client.ec2client, insId);
                  } else if (cloudRecord.state === State.RUNNING && e.state === State.HIBERNATE) {
                    await stopInstance(client.ec2client, insId, true);
                    e.state = State.STOPPED;
                    await AwsEc2Module.mappers.instance.db.update(e, ctx);
                  } else {
                    throw new Error(
                      `Invalid instance state transition. From CLOUD state ${cloudRecord.state} to DB state ${e.state}`,
                    );
                  }
                }
                out.push(e);
              } else {
                const created = await AwsEc2Module.mappers.instance.cloud.create(e, ctx);
                await AwsEc2Module.mappers.instance.cloud.delete(cloudRecord, ctx);
                out.push(created);
              }
            }
            return out;
          },
          delete: async (es: Instance[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const entity of es) {
              // Remove attached volume
              const rawAttachedVolume = (
                await getVolumesByInstanceId(client.ec2client, entity.instanceId ?? '')
              )?.pop();
              if (entity.instanceId) await terminateInstance(client.ec2client, entity.instanceId);
              await waitUntilDeleted(client.ec2client, rawAttachedVolume?.VolumeId ?? '');
              delete ctx?.memo?.cloud?.GeneralPurposeVolume?.[rawAttachedVolume?.VolumeId ?? ''];
              delete ctx?.memo?.db?.GeneralPurposeVolume?.[rawAttachedVolume?.VolumeId ?? ''];
              const attachedVolume = await AwsEc2Module.mappers.generalPurposeVolume.db.read(
                ctx,
                rawAttachedVolume?.VolumeId ?? '',
              );
              if (attachedVolume && !Array.isArray(attachedVolume))
                await AwsEc2Module.mappers.generalPurposeVolume.db.delete(attachedVolume, ctx);
            }
          },
        }),
      }),
      registeredInstance: new Mapper2<RegisteredInstance>({
        entity: RegisteredInstance,
        entityId: (e: RegisteredInstance) =>
          `${e.instance.instanceId}|${e.targetGroup.targetGroupArn}|${e.port}` ?? '',
        equals: (a: RegisteredInstance, b: RegisteredInstance) => Object.is(a.port, b.port),
        source: 'db',
        cloud: new Crud2({
          create: async (es: RegisteredInstance[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn)
                throw new Error('Valid targetGroup and instance needed.');
              if (!e.port) {
                e.port = e.targetGroup.port;
              }
              await registerInstance(
                client.elbClient,
                e.instance.instanceId,
                e.targetGroup.targetGroupArn,
                e.port,
              );
              const registeredInstance = await AwsEc2Module.mappers.registeredInstance.cloud.read(
                ctx,
                AwsEc2Module.mappers.registeredInstance.entityId(e),
              );
              await AwsEc2Module.mappers.registeredInstance.db.update(registeredInstance, ctx);
              out.push(registeredInstance);
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const [instanceId, targetGroupArn, port] = id.split('|');
              if (!instanceId || !targetGroupArn) return undefined;
              const registeredInstance = await getRegisteredInstance(
                client.elbClient,
                instanceId,
                targetGroupArn,
                port,
              );
              return await AwsEc2Module.utils.registeredInstanceMapper(registeredInstance, ctx);
            }
            const registeredInstances = (await getRegisteredInstances(client.elbClient)) ?? [];
            const out = [];
            for (const i of registeredInstances) {
              out.push(await AwsEc2Module.utils.registeredInstanceMapper(i, ctx));
            }
            return out;
          },
          updateOrReplace: () => 'replace',
          update: async (es: RegisteredInstance[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            const out = [];
            for (const e of es) {
              const cloudRecord =
                ctx?.memo?.cloud?.RegisteredInstance?.[AwsEc2Module.mappers.registeredInstance.entityId(e)];
              if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn)
                throw new Error('Valid targetGroup and instance needed.');
              if (!cloudRecord.instance?.instanceId || !cloudRecord.targetGroup?.targetGroupArn)
                throw new Error('Valid targetGroup and instance needed.');
              if (!e.port) {
                e.port = e.targetGroup.port;
              }
              await registerInstance(
                client.elbClient,
                e.instance.instanceId,
                e.targetGroup.targetGroupArn,
                e.port,
              );
              await deregisterInstance(
                client.elbClient,
                cloudRecord.instance.instanceId,
                cloudRecord.targetGroup.targetGroupArn,
                cloudRecord.port,
              );
              const registeredInstance = await AwsEc2Module.mappers.registeredInstance.cloud.read(
                ctx,
                AwsEc2Module.mappers.registeredInstance.entityId(e),
              );
              await AwsEc2Module.mappers.registeredInstance.db.update(registeredInstance, ctx);
              out.push(registeredInstance);
            }
            return out;
          },
          delete: async (es: RegisteredInstance[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of es) {
              if (!e.instance?.instanceId || !e.targetGroup?.targetGroupArn)
                throw new Error('Valid targetGroup and instance needed.');
              await deregisterInstance(
                client.elbClient,
                e.instance.instanceId,
                e.targetGroup.targetGroupArn,
                e.port,
              );
            }
          },
        }),
      }),
      generalPurposeVolume: new Mapper2<GeneralPurposeVolume>({
        entity: GeneralPurposeVolume,
        equals: (a: GeneralPurposeVolume, b: GeneralPurposeVolume) =>
          Object.is(a.attachedInstance?.instanceId, b.attachedInstance?.instanceId) &&
          Object.is(a.instanceDeviceName, b.instanceDeviceName) &&
          Object.is(a?.availabilityZone?.name, b?.availabilityZone?.name) &&
          Object.is(a.iops, b.iops) &&
          Object.is(a.size, b.size) &&
          Object.is(a.state, b.state) &&
          Object.is(a.throughput, b.throughput) &&
          Object.is(a.volumeType, b.volumeType) &&
          Object.is(a.snapshotId, b.snapshotId) &&
          AwsEc2Module.utils.eqTags(a.tags, b.tags),
        source: 'db',
        cloud: new Crud2({
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
              const newVolumeId = await createVolume(client.ec2client, input);
              if (newVolumeId && e.attachedInstance?.instanceId && e.instanceDeviceName) {
                await attachVolume(
                  client.ec2client,
                  newVolumeId,
                  e.attachedInstance.instanceId,
                  e.instanceDeviceName,
                );
              }
              // Re-get the inserted record to get all of the relevant records we care about
              const newObject = await getVolume(client.ec2client, newVolumeId);
              // We map this into the same kind of entity as `obj`
              const newEntity = await AwsEc2Module.utils.generalPurposeVolumeMapper(newObject, ctx);
              // Save the record back into the database to get the new fields updated
              newEntity.id = e.id;
              await AwsEc2Module.mappers.generalPurposeVolume.db.update(newEntity, ctx);
              out.push(newEntity);
            }
            return out;
          },
          read: async (ctx: Context, id?: string) => {
            const client = (await ctx.getAwsClient()) as AWS;
            if (id) {
              const rawVolume = await getVolume(client.ec2client, id);
              if (!rawVolume) return;
              return AwsEc2Module.utils.generalPurposeVolumeMapper(rawVolume, ctx);
            } else {
              const rawVolumes = (await getGeneralPurposeVolumes(client.ec2client)) ?? [];
              const out = [];
              for (const vol of rawVolumes) {
                out.push(await AwsEc2Module.utils.generalPurposeVolumeMapper(vol, ctx));
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
              const isUpdate =
                AwsEc2Module.mappers.generalPurposeVolume.cloud.updateOrReplace(cloudRecord, e) === 'update';
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
                  await updateVolume(client.ec2client, input);
                  update = true;
                }
                // Update tags
                if (!AwsEc2Module.utils.eqTags(cloudRecord.tags, e.tags)) {
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
                    await attachVolume(
                      client.ec2client,
                      e.volumeId ?? '',
                      e.attachedInstance.instanceId,
                      e.instanceDeviceName ?? '',
                    );
                  } else if (cloudRecord.attachedInstance?.instanceId && !e.attachedInstance?.instanceId) {
                    await detachVolume(client.ec2client, e.volumeId ?? '');
                  } else {
                    await detachVolume(client.ec2client, e.volumeId ?? '');
                    await attachVolume(
                      client.ec2client,
                      e.volumeId ?? '',
                      e.attachedInstance?.instanceId ?? '',
                      e.instanceDeviceName ?? '',
                    );
                  }
                  update = true;
                }
                if (update) {
                  const rawVolume = await getVolume(client.ec2client, e.volumeId);
                  const updatedVolume = await AwsEc2Module.utils.generalPurposeVolumeMapper(rawVolume, ctx);
                  updatedVolume.id = e.id;
                  await AwsEc2Module.mappers.generalPurposeVolume.db.update(updatedVolume, ctx);
                  out.push(updatedVolume);
                } else {
                  // Restore
                  cloudRecord.id = e.id;
                  await AwsEc2Module.mappers.generalPurposeVolume.db.update(cloudRecord, ctx);
                  out.push(cloudRecord);
                }
              } else {
                // Replace
                const newVolume = await AwsEc2Module.mappers.generalPurposeVolume.cloud.create(e, ctx);
                await AwsEc2Module.mappers.generalPurposeVolume.cloud.delete(cloudRecord, ctx);
                out.push(newVolume);
              }
            }
            return out;
          },
          delete: async (vol: GeneralPurposeVolume[], ctx: Context) => {
            const client = (await ctx.getAwsClient()) as AWS;
            for (const e of vol) {
              if (e.attachedInstance) {
                await detachVolume(client.ec2client, e.volumeId ?? '');
              }
              await deleteVolume(client.ec2client, e.volumeId ?? '');
            }
          },
        }),
      }),
    },
  },
  __dirname,
);
