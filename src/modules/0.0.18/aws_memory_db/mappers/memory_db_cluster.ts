import { Cluster as AWSCluster, CreateClusterCommandInput, DescribeSubnetGroupsCommandInput, DescribeSubnetGroupsCommandOutput, MemoryDB, Tag as AWSTag } from '@aws-sdk/client-memorydb';

import isEqual from 'lodash.isequal';

import { AwsMemoryDBModule } from '..';
import { MemoryDBCluster, NodeTypeEnum, } from '../entity'
import { Context, Crud2, MapperBase, } from '../../../interfaces'
import {
  AWS,
  crudBuilder2,
  crudBuilderFormat,
} from '../../../../services/aws_macros'
import { awsSecurityGroupModule } from '../../aws_security_group';
import { awsVpcModule } from '../../aws_vpc';
import { Subnet, Vpc } from '../../aws_vpc/entity';

export class MemoryDBClusterMapper extends MapperBase<MemoryDBCluster> {
  module: AwsMemoryDBModule;
  entity = MemoryDBCluster;
  equals = (a: MemoryDBCluster, b: MemoryDBCluster) =>
    Object.is(a.address, b.address)
    && Object.is(a.arn, b.arn)
    && Object.is(a.description, b.description)
    && Object.is(a.nodeType, b.nodeType)
    && Object.is(a.port, b.port)
    && Object.is(a.securityGroups?.length, b.securityGroups?.length)
    && (a.securityGroups
      ?.every(asg => !!b.securityGroups
        ?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
    && Object.is(a.status, b.status)
    && Object.is(a.subnets?.length, b.subnets?.length)
    && (a.subnets?.every(asn => !!b.subnets?.find(bsn => Object.is(asn, bsn))) ?? false);
    // todo: && isEqual(a.tags, b.tags);

  async memoryDBClusterMapper(cloudE: AWSCluster, ctx: Context) {
    const out = new MemoryDBCluster();
    if (!cloudE?.ARN || !cloudE?.Name || !cloudE?.NodeType) return undefined;
    out.address = cloudE.ClusterEndpoint?.Address;
    out.arn = cloudE.ARN;
    out.clusterName = cloudE.Name;
    out.description = cloudE.Description;
    out.nodeType = cloudE.NodeType as NodeTypeEnum;
    out.port = cloudE.ClusterEndpoint?.Port ?? 6379;
    if (cloudE.SecurityGroups?.length) {
      const securityGroups = [];
      for (const sgm of cloudE.SecurityGroups) {
        try {
          const sg = await awsSecurityGroupModule.securityGroup.db.read(ctx, sgm.SecurityGroupId) ??
            await awsSecurityGroupModule.securityGroup.cloud.read(ctx, sgm.SecurityGroupId);
          if (sg) securityGroups.push(sg);
        } catch (_) {/*Ignore misconfigured security groups*/}
      }
      out.securityGroups = securityGroups;
    }
    out.status = cloudE.Status;
    if (cloudE.SubnetGroupName) {
      const client = await ctx.getAwsClient() as AWS;
      const subnetGroupSubnets = await this.getSubnetGroupSubnets(client.memoryDBClient, cloudE.SubnetGroupName);
      out.subnets = subnetGroupSubnets;
    }
    // todo: out.tags = 
    return out;
  }

  getSubnetGroupSubnets = crudBuilderFormat<MemoryDB, 'describeSubnetGroups', string[] | undefined>(
    'describeSubnetGroups',
    (SubnetGroupName: string) => ({ SubnetGroupName }),
    (res) => res?.SubnetGroups?.pop()?.Subnets?.map(sn => sn.Identifier ?? '')
  );

  createSubnetGroup = crudBuilder2<MemoryDB, 'createSubnetGroup'>(
    'createSubnetGroup',
    (SubnetGroupName: string, SubnetIds: string[]) => ({SubnetGroupName, SubnetIds})
  );

  createCluster = crudBuilderFormat<MemoryDB, 'createCluster', string | undefined>(
    'createCluster',
    (input) => input,
    (res) => res?.Cluster?.Name
  );

  getCluster = crudBuilderFormat<MemoryDB, 'describeClusters', AWSCluster | undefined>(
    'describeClusters',
    (ClusterName: string) => ({ ClusterName, }),
    (res) => res?.Clusters?.pop()
  );

  // todo: eventually add manual pagination
  getClusters = crudBuilderFormat<MemoryDB, 'describeClusters', AWSCluster[] | undefined>(
    'describeClusters',
    () => ({}),
    (res) => res?.Clusters
  );

  deleteCluster = crudBuilder2<MemoryDB, 'deleteCluster'>(
    'deleteCluster',
    (ClusterName: string) => ({ ClusterName, })
  );

  cloud: Crud2<MemoryDBCluster> = new Crud2({
    create: async (es: MemoryDBCluster[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = []
      for (const e of es) {
        // todo: create subnet group first
        let subnetIds: string[] = [];
        if (!e.subnets?.length) {
          const defaultVpc: Vpc = (await awsVpcModule.vpc.db.read(ctx)).filter((vpc: Vpc) => vpc.isDefault).pop();
          const subnets: Subnet[] = await awsVpcModule.subnet.db.read(ctx);
          const defaultSubnets = subnets.filter(sn => sn.vpc.id === defaultVpc.id);
          subnetIds = defaultSubnets.map(sn => sn.subnetId ?? '');
        } else {
          subnetIds = e.subnets;
        }
        await this.createSubnetGroup(client.memoryDBClient, e.clusterName, subnetIds);
        const input: CreateClusterCommandInput = {
          ACLName: 'open-access',
          ClusterName: e.clusterName,
          NodeType: e.nodeType,
          Description: e.description,
          Port: e.port,
          SecurityGroupIds: e.securityGroups?.map(sg => sg.groupId ?? '') ?? [],
          SubnetGroupName: e.clusterName,
        };
        // todo: add tags
        const newClusterName = await this.createCluster(client.memoryDBClient, input);
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getCluster(client.memoryDBClient, newClusterName);
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.memoryDBClusterMapper(newObject, ctx);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        newEntity.id = e.id;
        await this.module.memoryDBCluster.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = await ctx.getAwsClient() as AWS;
      if (id) {
        const rawCluster = await this.getCluster(client.memoryDBClient, id);
        if (!rawCluster) return;
        return this.memoryDBClusterMapper(rawCluster, ctx);
      } else {
        const rawClusters = (await this.getClusters(client.memoryDBClient)) ?? [];
        const out = [];
        for (const cl of rawClusters) {
          const outCl = await this.memoryDBClusterMapper(cl, ctx);
          if (outCl) out.push(outCl);
        }
        return out;
      }
    },
    // todo: updateOrReplace: (prev: GeneralPurposeVolume, next: GeneralPurposeVolume) => {
    //   if (!Object.is(prev?.availabilityZone?.name, next?.availabilityZone?.name) || !Object.is(prev.snapshotId, next.snapshotId)) return 'replace';
    //   return 'update';
    // },
    update: async (es: MemoryDBCluster[], ctx: Context) => {
      return es;
      // const client = await ctx.getAwsClient() as AWS;
      // const out = [];
      // for (const e of es) {
      //   const cloudRecord = ctx?.memo?.cloud?.GeneralPurposeVolume?.[e.volumeId ?? ''];
      //   const isUpdate = this.module.generalPurposeVolume.cloud.updateOrReplace(cloudRecord, e) === 'update';
      //   if (isUpdate) {
      //     let update = false;
      //     // Update volume
      //     if (!(Object.is(cloudRecord.iops, e.iops) && Object.is(cloudRecord.size, e.size)
      //       && Object.is(cloudRecord.throughput, e.throughput) && Object.is(cloudRecord.volumeType, e.volumeType))) {
      //       if (e.volumeType === GeneralPurposeVolumeType.GP2) {
      //         e.throughput = undefined;
      //         e.iops = undefined;
      //       }
      //       const input: ModifyVolumeCommandInput = {
      //         VolumeId: e.volumeId,
      //         Size: e.size,
      //         Throughput: e.volumeType === GeneralPurposeVolumeType.GP3 ? e.throughput : undefined,
      //         Iops: e.volumeType === GeneralPurposeVolumeType.GP3 ? e.iops : undefined,
      //         VolumeType: e.volumeType,
      //       };
      //       await this.updateVolume(client.ec2client, input)
      //       update = true;
      //     }
      //     // Update tags
      //     if (!eqTags(cloudRecord.tags, e.tags)) {
      //       await updateTags(client.ec2client, e.volumeId ?? '', e.tags);
      //       update = true;
      //     }
      //     // Attach/detach instance
      //     if (!(Object.is(cloudRecord.attachedInstance?.instanceId, e.attachedInstance?.instanceId)
      //       && Object.is(cloudRecord.instanceDeviceName, e.instanceDeviceName))) {
      //       if (!cloudRecord.attachedInstance?.instanceId && e.attachedInstance?.instanceId) {
      //         await this.attachVolume(client.ec2client, e.volumeId ?? '', e.attachedInstance.instanceId, e.instanceDeviceName ?? '');
      //       } else if (cloudRecord.attachedInstance?.instanceId && !e.attachedInstance?.instanceId) {
      //         await this.detachVolume(client.ec2client, e.volumeId ?? '');
      //       } else {
      //         await this.detachVolume(client.ec2client, e.volumeId ?? '');
      //         await this.attachVolume(client.ec2client, e.volumeId ?? '', e.attachedInstance?.instanceId ?? '', e.instanceDeviceName ?? '');
      //       }
      //       update = true;
      //     }
      //     if (update) {
      //       const rawVolume = await this.getVolume(client.ec2client, e.volumeId);
      //       if (!rawVolume) continue;
      //       const updatedVolume = await this.generalPurposeVolumeMapper(rawVolume, ctx);
      //       if (!updatedVolume) continue;
      //       updatedVolume.id = e.id;
      //       await this.module.generalPurposeVolume.db.update(updatedVolume, ctx);
      //       out.push(updatedVolume);
      //     } else {
      //       // Restore
      //       cloudRecord.id = e.id;
      //       await this.module.generalPurposeVolume.db.update(cloudRecord, ctx);
      //       out.push(cloudRecord);
      //     }
      //   } else {
      //     // Replace
      //     const newVolume = await this.module.generalPurposeVolume.cloud.create(e, ctx);
      //     await this.module.generalPurposeVolume.cloud.delete(cloudRecord, ctx);
      //     out.push(newVolume);
      //   }
      // }
      // return out;
    },
    delete: async (es: MemoryDBCluster[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      for (const e of es) {
        await this.deleteCluster(client.memoryDBClient, e.clusterName ?? '');
      }
    },
  });

  constructor(module: AwsMemoryDBModule) {
    super();
    this.module = module;
    super.init();
  }
}
