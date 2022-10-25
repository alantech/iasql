import {
  Cluster as AWSCluster,
  CreateClusterCommandInput,
  DescribeClustersCommandInput,
  MemoryDB,
  UpdateClusterCommandInput,
} from '@aws-sdk/client-memorydb';
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter';

import { awsMemoryDBModule, AwsMemoryDBModule } from '..';
import { AWS, crudBuilder2, crudBuilderFormat } from '../../../../services/aws_macros';
import logger from '../../../../services/logger';
import { Context, Crud2, MapperBase } from '../../../interfaces';
import { awsSecurityGroupModule } from '../../aws_security_group';
import { SecurityGroup } from '../../aws_security_group/entity';
import { MemoryDBCluster, NodeTypeEnum } from '../entity';
import supportedRegions from './supported_regions';

export class MemoryDBClusterMapper extends MapperBase<MemoryDBCluster> {
  module: AwsMemoryDBModule;
  entity = MemoryDBCluster;
  equals = (a: MemoryDBCluster, b: MemoryDBCluster) =>
    Object.is(a.address, b.address) &&
    Object.is(a.arn, b.arn) &&
    Object.is(a.description, b.description) &&
    Object.is(a.nodeType, b.nodeType) &&
    Object.is(a.port, b.port) &&
    Object.is(a.securityGroups?.length, b.securityGroups?.length) &&
    (a.securityGroups?.every(asg => !!b.securityGroups?.find(bsg => Object.is(asg.groupId, bsg.groupId))) ??
      false) &&
    Object.is(a.status, b.status) &&
    Object.is(a.subnetGroup?.subnetGroupName, b.subnetGroup?.subnetGroupName);
  // todo: && isEqual(a.tags, b.tags);  // update

  async memoryDBClusterMapper(cloudE: AWSCluster, ctx: Context, region: string) {
    const out = new MemoryDBCluster();
    if (!cloudE?.ARN || !cloudE?.Name || !cloudE?.NodeType || !cloudE.SubnetGroupName) return undefined;
    out.address = cloudE.ClusterEndpoint?.Address;
    out.arn = cloudE.ARN;
    out.clusterName = cloudE.Name;
    out.description = cloudE.Description;
    out.nodeType = cloudE.NodeType as NodeTypeEnum;
    out.port = cloudE.ClusterEndpoint?.Port ?? 6379;
    const securityGroups = [];
    for (const sgm of cloudE.SecurityGroups ?? []) {
      try {
        const sg =
          (await awsSecurityGroupModule.securityGroup.db.read(
            ctx,
            awsSecurityGroupModule.securityGroup.generateId({ groupId: sgm.SecurityGroupId ?? '', region }),
          )) ??
          (await awsSecurityGroupModule.securityGroup.cloud.read(
            ctx,
            awsSecurityGroupModule.securityGroup.generateId({ groupId: sgm.SecurityGroupId ?? '', region }),
          ));
        if (sg) securityGroups.push(sg);
      } catch (e: any) {
        /*Ignore misconfigured security groups*/
        logger.warn(
          `Error retrieving security group ${sgm?.SecurityGroupId} mapping memory db cluster: ${e.message}`,
        );
      }
    }
    out.securityGroups = securityGroups;
    out.status = cloudE.Status;
    out.subnetGroup =
      (await this.module.subnetGroup.db.read(
        ctx,
        this.module.subnetGroup.generateId({ subnetGroupName: cloudE.SubnetGroupName, region }),
      )) ??
      (await this.module.subnetGroup.cloud.read(
        ctx,
        this.module.subnetGroup.generateId({ subnetGroupName: cloudE.SubnetGroupName, region }),
      ));
    // todo: out.tags =
    out.region = region;
    return out;
  }

  createCluster = crudBuilderFormat<MemoryDB, 'createCluster', string | undefined>(
    'createCluster',
    input => input,
    res => res?.Cluster?.Name,
  );

  getCluster = crudBuilderFormat<MemoryDB, 'describeClusters', AWSCluster | undefined>(
    'describeClusters',
    (ClusterName: string) => ({ ClusterName }),
    res => res?.Clusters?.pop(),
  );

  // todo: eventually add manual pagination
  getClusters = crudBuilderFormat<MemoryDB, 'describeClusters', AWSCluster[] | undefined>(
    'describeClusters',
    () => ({}),
    res => res?.Clusters,
  );

  deleteCluster = crudBuilder2<MemoryDB, 'deleteCluster'>('deleteCluster', (ClusterName: string) => ({
    ClusterName,
  }));

  updateCluster = crudBuilder2<MemoryDB, 'updateCluster'>('updateCluster', input => input);

  listAllowedNodeTypeUpdates = crudBuilder2<MemoryDB, 'listAllowedNodeTypeUpdates'>(
    'listAllowedNodeTypeUpdates',
    (ClusterName: string) => ({ ClusterName }),
  );

  waitClusterUntil = async (client: MemoryDB, ClusterName: string, readyStatus: string) => {
    await createWaiter<MemoryDB, DescribeClustersCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 1800,
        minDelay: 1,
        maxDelay: 4,
      },
      { ClusterName },
      async (clnt, cmdInput) => {
        try {
          const data = await clnt.describeClusters(cmdInput);
          for (const cluster of data?.Clusters ?? []) {
            if (cluster.Status !== readyStatus) {
              return { state: WaiterState.RETRY };
            }
          }
          return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          if (e.name === 'ClusterNotFoundFault') {
            return { state: WaiterState.SUCCESS };
          }
          throw e;
        }
      },
    );
  };

  cloud: Crud2<MemoryDBCluster> = new Crud2({
    create: async (es: MemoryDBCluster[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        // Check if subnet group already exists
        if (!e.subnetGroup.arn) throw new Error('Subnet group need to be created first');
        // Now create the cluster
        const input: CreateClusterCommandInput = {
          ACLName: 'open-access',
          ClusterName: e.clusterName,
          NodeType: e.nodeType,
          Description: e.description,
          Port: e.port,
          SecurityGroupIds: e.securityGroups?.map(sg => sg.groupId ?? '') ?? [],
          SubnetGroupName: e.subnetGroup.subnetGroupName,
        };
        // todo: add tags
        const newClusterName = await this.createCluster(client.memoryDBClient, input);
        await this.waitClusterUntil(client.memoryDBClient, newClusterName ?? '', 'available');
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await this.getCluster(client.memoryDBClient, newClusterName);
        if (!newObject) continue;
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.memoryDBClusterMapper(newObject, ctx, e.region);
        if (!newEntity) continue;
        // Save the record back into the database to get the new fields updated
        newEntity.id = e.id;
        await this.module.memoryDBCluster.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (!!id) {
        const { clusterName, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        if (!supportedRegions.includes(region)) return;
        const rawCluster = await this.getCluster(client.memoryDBClient, clusterName);
        if (!rawCluster) return;
        return this.memoryDBClusterMapper(rawCluster, ctx, region);
      } else {
        const out: MemoryDBCluster[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            if (!supportedRegions.includes(region)) return;
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rawClusters = (await this.getClusters(client.memoryDBClient)) ?? [];
            for (const cl of rawClusters) {
              const outCl = await this.memoryDBClusterMapper(cl, ctx, region);
              if (outCl) out.push(outCl);
            }
          }),
        );
        return out;
      }
    },
    updateOrReplace: (prev: MemoryDBCluster, next: MemoryDBCluster) => {
      if (
        !Object.is(prev?.port, next?.port) ||
        !Object.is(prev?.subnetGroup?.subnetGroupName, next?.subnetGroup?.subnetGroupName)
      ) {
        return 'replace';
      }
      return 'update';
    },
    update: async (es: MemoryDBCluster[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.MemoryDBCluster?.[this.entityId(e)];
        const isUpdate = this.module.memoryDBCluster.cloud.updateOrReplace(cloudRecord, e) === 'update';
        if (isUpdate) {
          // todo: add waiters
          let update = false;
          if (!Object.is(cloudRecord.nodeType, e.nodeType)) {
            // Node type update
            // Get allowed list and if valid upgrade, otherwise do not call API and
            // restore record when invalid node type. Eventually would be nice
            // to let user know he has an invalid node type as input
            const allowedNodeTypes = await this.listAllowedNodeTypeUpdates(
              client.memoryDBClient,
              e.clusterName,
            );
            if (
              allowedNodeTypes?.ScaleDownNodeTypes?.includes(e.nodeType) ||
              allowedNodeTypes?.ScaleUpNodeTypes?.includes(e.nodeType)
            ) {
              const input: UpdateClusterCommandInput = {
                ClusterName: e.clusterName,
                NodeType: e.nodeType,
              };
              await this.updateCluster(client.memoryDBClient, input);
              await this.waitClusterUntil(client.memoryDBClient, e.clusterName, 'available');
              update = true;
            }
          }
          if (
            !(
              Object.is(cloudRecord.securityGroups?.length, e.securityGroups?.length) &&
              !!cloudRecord.securityGroups?.every(
                (crsg: SecurityGroup) =>
                  !!e.securityGroups?.find(esg => Object.is(crsg.groupId, esg.groupId)),
              ) &&
              Object.is(cloudRecord.description, e.description)
            )
          ) {
            // Description and/or security group update
            const input: UpdateClusterCommandInput = {
              ClusterName: e.clusterName,
              Description: e.description,
              SecurityGroupIds: e.securityGroups?.map(sg => sg.groupId ?? '') ?? [],
            };
            await this.updateCluster(client.memoryDBClient, input);
            update = true;
          }
          // todo: tags
          if (update) {
            const rawCluster = await this.getCluster(client.memoryDBClient, e.clusterName ?? '');
            if (!rawCluster) continue;
            const newCluster = await this.memoryDBClusterMapper(rawCluster, ctx, e.region);
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
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteCluster(client.memoryDBClient, e.clusterName ?? '');
        await this.waitClusterUntil(client.memoryDBClient, e.clusterName, 'deleted');
      }
    },
  });

  constructor(module: AwsMemoryDBModule) {
    super();
    this.module = module;
    super.init();
  }
}
