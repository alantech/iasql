import {
  Cluster as AWSCluster,
  CreateClusterCommandInput,
  MemoryDB,
  Tag as AWSTag,
  UpdateClusterCommandInput,
  UpdateSubnetGroupCommandInput
} from '@aws-sdk/client-memorydb';

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
import { SecurityGroup } from '../../aws_security_group/entity';

export class MemoryDBClusterMapper extends MapperBase<MemoryDBCluster> {
  module: AwsMemoryDBModule;
  entity = MemoryDBCluster;
  equals = (a: MemoryDBCluster, b: MemoryDBCluster) =>
    Object.is(a.address, b.address) // restore
    && Object.is(a.arn, b.arn) // restore
    && Object.is(a.description, b.description) // update
    && Object.is(a.nodeType, b.nodeType) // update
    && Object.is(a.port, b.port) // replace
    && Object.is(a.securityGroups?.length, b.securityGroups?.length)  // update
    && (a.securityGroups
      ?.every(asg => !!b.securityGroups
        ?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
    && Object.is(a.status, b.status)  // restore
    && Object.is(a.subnets?.length, b.subnets?.length)  // update
    && (a.subnets?.every(asn => !!b.subnets?.find(bsn => Object.is(asn, bsn))) ?? false);
    // todo: && isEqual(a.tags, b.tags);  // update

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

  getDefaultSubnets = async (ctx: Context): Promise<Subnet[]> => {
    const defaultVpc: Vpc = (await awsVpcModule.vpc.db.read(ctx)).filter((vpc: Vpc) => vpc.isDefault).pop();
    const subnets: Subnet[] = await awsVpcModule.subnet.db.read(ctx);
    return subnets.filter(sn => sn.vpc.id === defaultVpc.id);
  };

  updateSubnetGroup = crudBuilder2<MemoryDB, 'updateSubnetGroup'>(
    'updateSubnetGroup',
    (input) => input,
  );

  updateCluster = crudBuilder2<MemoryDB, 'updateCluster'>(
    'updateCluster',
    (input) => input
  );

  listAllowedNodeTypeUpdates = crudBuilder2<MemoryDB, 'listAllowedNodeTypeUpdates'>(
    'listAllowedNodeTypeUpdates',
    (ClusterName: string) => ({ ClusterName })
  );

  cloud: Crud2<MemoryDBCluster> = new Crud2({
    create: async (es: MemoryDBCluster[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = []
      for (const e of es) {
        // Create subnet group first
        let subnetIds: string[] = [];
        if (!e.subnets?.length) {
          const defaultSubnets = await this.getDefaultSubnets(ctx);
          subnetIds = defaultSubnets.map(sn => sn.subnetId ?? '');
        } else {
          subnetIds = e.subnets;
        }
        await this.createSubnetGroup(client.memoryDBClient, e.clusterName, subnetIds);
        // Now create the cluster
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
    updateOrReplace: (prev: MemoryDBCluster, next: MemoryDBCluster) => {
      if (!Object.is(prev?.port, next?.port)) return 'replace';
      return 'update';
    },
    update: async (es: MemoryDBCluster[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.MemoryDBCluster?.[e.clusterName ?? ''];
        const isUpdate = this.module.memoryDBCluster.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          let update = false;
          if (!Object.is(cloudRecord.subnets?.length, e.subnets?.length)
            && !(cloudRecord.subnets?.every((asn: string[]) => !!e.subnets?.find(bsn => Object.is(asn, bsn))) ?? false)) {
            // Subnet group needs to be updated
            let subnetIds: string[] = [];
            if (!e.subnets?.length) {
              const defaultSubnets = await this.getDefaultSubnets(ctx);
              subnetIds = defaultSubnets.map(sn => sn.subnetId ?? '');
            } else {
              subnetIds = e.subnets;
            }
            const input: UpdateSubnetGroupCommandInput = {
              SubnetGroupName: e.clusterName,
              SubnetIds: subnetIds,
            };
            await this.updateSubnetGroup(client.memoryDBClient, input);
            update = true;
          }
          if (!Object.is(cloudRecord.nodeType, e.nodeType)) {
            // Node type update
            // Get allowed list and if valid upgrade, otherwise do not call API and
            // restore record when invalid node type. Eventually would be nice
            // to let user know he has an invalid node type as input
            const allowedNodeTypes = await this.listAllowedNodeTypeUpdates(client.memoryDBClient, e.clusterName);
            if (allowedNodeTypes?.ScaleDownNodeTypes?.includes(e.nodeType)
              || allowedNodeTypes?.ScaleUpNodeTypes?.includes(e.nodeType)) {
              const input: UpdateClusterCommandInput = {
                ClusterName: e.clusterName,
                NodeType: e.nodeType,
              };
              await this.updateCluster(client.memoryDBClient, input);
              update = true;
            }
          }
          if (!(Object.is(cloudRecord.securityGroups?.length, e.securityGroups?.length)
              && !!cloudRecord.securityGroups
                ?.every((crsg: SecurityGroup) => !!e.securityGroups?.find(esg => Object.is(crsg.groupId, esg.groupId)))
              && Object.is(cloudRecord.description, e.description))) {
            // Description and/or security group update
            const input: UpdateClusterCommandInput = {
              ClusterName: e.clusterName,
              Description: e.description,
              SecurityGroupIds: e.securityGroups?.map(sg => sg.groupId ?? '') ?? []
            };
            await this.updateCluster(client.memoryDBClient, input);
            update = true;
          }
          // todo: tags
          // if (!eqTags(cloudRecord.tags, e.tags)) {
          //   // Tags update
          //   await updateTags(client.ec2client, e.vpcEndpointId ?? '', e.tags);
          //   update = true;
          // }
          if (update) {
            const rawCluster = await this.getCluster(
              client.memoryDBClient,
              e.clusterName ?? ''
            );
            if (!rawCluster) continue;
            const newCluster = await this.memoryDBClusterMapper(rawCluster, ctx);
            if (!newCluster) continue;
            newCluster.id = e.id;
            await this.module.memoryDBCluster.db.update(newCluster, ctx);
            out.push(newCluster);
          } else {
            // Restore record
            cloudRecord.id = e.id;
            await this.module.memoryDBCluster.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          }
        } else {
          // Replace record
          const newCluster = await this.module.memoryDBCluster.cloud.create(e, ctx);
          await this.module.memoryDBCluster.cloud.delete(cloudRecord, ctx);
          out.push(newCluster);
        }
      }
      return out;
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
