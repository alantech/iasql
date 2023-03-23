import {
  RDS,
  DBCluster as AWSDBCluster,
  CreateDBClusterCommandInput,
  waitUntilDBClusterAvailable,
  paginateDescribeDBClusters,
  ModifyDBClusterCommandInput,
  DeleteDBClusterMessage,
  waitUntilDBClusterDeleted,
  DescribeDBClustersCommandInput,
  Tag as AWSTag,
} from '@aws-sdk/client-rds';
import { createWaiter, WaiterOptions, WaiterState } from '@aws-sdk/util-waiter';

import { AwsRdsModule } from '..';
import { AWS, crudBuilderFormat, eqTags, paginateBuilder } from '../../../services/aws_macros';
import { awsSecurityGroupModule } from '../../aws_security_group';
import { Context, Crud, MapperBase } from '../../interfaces';
import { DBCluster, dbClusterEngineEnum } from '../entity/db_cluster';
import { updateTags } from './tags';

export class DBClusterMapper extends MapperBase<DBCluster> {
  module: AwsRdsModule;
  entity = DBCluster;
  equals = (a: DBCluster, b: DBCluster) =>
    Object.is(a.allocatedStorage, b.allocatedStorage) &&
    Object.is(a.iops, b.iops) &&
    Object.is(a.backupRetentionPeriod, b.backupRetentionPeriod) &&
    Object.is(a.dbClusterInstanceClass, b.dbClusterInstanceClass) &&
    Object.is(a.arn, b.arn) &&
    Object.is(a.deletionProtection, b.deletionProtection) &&
    Object.is(a.engine, b.engine) &&
    Object.is(a.engineVersion, b.engineVersion) &&
    !a.masterUserPassword && // Special case, if master password defined, will update the password
    Object.is(a.masterUsername, b.masterUsername) &&
    Object.is(a.port, b.port) &&
    Object.is(a.publiclyAccessible, b.publiclyAccessible) &&
    Object.is(a.storageEncrypted, b.storageEncrypted) &&
    Object.is(a.subnetGroup?.name, b.subnetGroup?.name) &&
    Object.is(a.vpcSecurityGroups.length, b.vpcSecurityGroups.length) &&
    eqTags(a.tags, b.tags) &&
    Object.is(a.arn, b.arn) &&
    (a.vpcSecurityGroups?.every(
      asg => !!b.vpcSecurityGroups.find(bsg => Object.is(asg.groupId, bsg.groupId)),
    ) ??
      false);

  async dbClusterMapper(cluster: AWSDBCluster, ctx: Context, region: string) {
    const out = new DBCluster();
    if (!cluster.DBClusterIdentifier || !cluster.AllocatedStorage || !cluster.DBClusterInstanceClass)
      return undefined;
    out.allocatedStorage = cluster.AllocatedStorage;
    out.backupRetentionPeriod = cluster.BackupRetentionPeriod;
    out.dbClusterIdentifier = cluster.DBClusterIdentifier;
    out.arn = cluster.DBClusterArn;
    out.dbClusterInstanceClass = cluster.DBClusterInstanceClass;
    out.deletionProtection = cluster.DeletionProtection ?? false;
    out.engine = cluster.Engine as dbClusterEngineEnum;
    if (cluster.EngineVersion) out.engineVersion = cluster.EngineVersion;
    if (cluster.MasterUsername) out.masterUsername = cluster.MasterUsername;

    if (cluster.DBSubnetGroup) {
      out.subnetGroup =
        (await this.module.dbSubnetGroup.db.read(
          ctx,
          this.module.dbSubnetGroup.generateId({ name: cluster.DBSubnetGroup, region }),
        )) ??
        (await this.module.dbSubnetGroup.cloud.read(
          ctx,
          this.module.dbSubnetGroup.generateId({ name: cluster.DBSubnetGroup, region }),
        ));
    }

    out.port = cluster.Port;
    out.publiclyAccessible = cluster.PubliclyAccessible ?? false;
    out.storageEncrypted = cluster.StorageEncrypted ?? false;
    if (cluster.Iops) out.iops = cluster.Iops;
    out.region = region;

    out.vpcSecurityGroups = [];
    const vpcSecurityGroupIds = cluster?.VpcSecurityGroups?.filter(
      (vpcsg: any) => !!vpcsg?.VpcSecurityGroupId,
    ).map((vpcsg: any) => vpcsg?.VpcSecurityGroupId);

    for (const sgId of vpcSecurityGroupIds ?? []) {
      try {
        const sg =
          (await awsSecurityGroupModule.securityGroup.db.read(
            ctx,
            awsSecurityGroupModule.securityGroup.generateId({ groupId: sgId, region }),
          )) ??
          (await awsSecurityGroupModule.securityGroup.cloud.read(
            ctx,
            awsSecurityGroupModule.securityGroup.generateId({ groupId: sgId, region }),
          ));
        if (sg) out.vpcSecurityGroups.push(sg);
      } catch (e) {
        // Ignore
      }
    }

    if (cluster.TagList?.length) {
      const tags: { [key: string]: string } = {};
      cluster.TagList.filter((t: any) => !!t.Key && !!t.Value).forEach((t: any) => {
        tags[t.Key as string] = t.Value as string;
      });
      out.tags = tags;
    }

    return out;
  }

  async createDBCluster(client: RDS, clusterParams: CreateDBClusterCommandInput) {
    await client.createDBCluster(clusterParams);

    // wait until cluster is available
    const result = await waitUntilDBClusterAvailable(
      {
        client,
        // all in seconds
        maxWaitTime: 60 * 30,
        minDelay: 1,
        maxDelay: 4,
      } as WaiterOptions<RDS>,
      { DBClusterIdentifier: clusterParams.DBClusterIdentifier },
    );
    return result.state === WaiterState.SUCCESS;
  }

  async updateDBCluster(client: RDS, clusterParams: ModifyDBClusterCommandInput) {
    await client.modifyDBCluster(clusterParams);

    let out;
    const clusterId = clusterParams.DBClusterIdentifier;
    await createWaiter<RDS, DescribeDBClustersCommandInput>(
      {
        client,
        // all in seconds
        maxWaitTime: 60 * 30,
        minDelay: 1,
        maxDelay: 4,
      },
      { DBClusterIdentifier: clusterId },
      async (cl, cmd) => {
        const data = await cl.describeDBClusters(cmd);
        try {
          out = data.DBClusters?.pop();

          // check if we have pending modifications
          if (out?.PendingModifiedValues) return { state: WaiterState.RETRY };
          else return { state: WaiterState.SUCCESS };
        } catch (e: any) {
          throw e;
        }
      },
    );
    return out;
  }

  async deleteDBCluster(client: RDS, deleteInput: DeleteDBClusterMessage) {
    await client.deleteDBCluster(deleteInput);
    // wait until cluster is deleted
    const result = await waitUntilDBClusterDeleted(
      {
        client,
        // all in seconds
        maxWaitTime: 60 * 30,
        minDelay: 1,
        maxDelay: 4,
      } as WaiterOptions<RDS>,
      { DBClusterIdentifier: deleteInput.DBClusterIdentifier },
    );
    return result.state === WaiterState.SUCCESS;
  }

  getDBCluster = crudBuilderFormat<RDS, 'describeDBClusters', AWSDBCluster | undefined>(
    'describeDBClusters',
    DBClusterIdentifier => ({ DBClusterIdentifier }),
    res => res?.DBClusters?.[0],
  );

  getAllDBClusters = paginateBuilder<RDS>(paginateDescribeDBClusters, 'DBClusters');
  getDBClusters = async (client: RDS) =>
    (await this.getAllDBClusters(client)).flat().filter(dbCluster => dbCluster.Status === 'available');

  cloud = new Crud({
    create: async (es: DBCluster[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const securityGroupIds =
          e.vpcSecurityGroups?.map(sg => {
            if (!sg.groupId) throw new Error('Security group needs to exist');
            return sg.groupId;
          }) ?? [];
        if (!e.masterUserPassword) throw new Error('Master user password is required');

        const clusterParams: CreateDBClusterCommandInput = {
          AllocatedStorage: e.allocatedStorage,
          BackupRetentionPeriod: e.backupRetentionPeriod,
          DBClusterIdentifier: e.dbClusterIdentifier,
          DBClusterInstanceClass: e.dbClusterInstanceClass,
          DeletionProtection: e.deletionProtection,
          Engine: e.engine,
          EngineVersion: e.engineVersion,
          MasterUsername: e.masterUsername,
          MasterUserPassword: e.masterUserPassword,
          Port: e.port,
          StorageType: 'io1',
          Iops: e.iops,
          PubliclyAccessible: e.publiclyAccessible,
          StorageEncrypted: e.storageEncrypted,
          VpcSecurityGroupIds: securityGroupIds,
        };
        if (e.subnetGroup) clusterParams.DBSubnetGroupName = e.subnetGroup.name;

        if (e.tags && Object.keys(e.tags).length) {
          const tags: AWSTag[] = Object.keys(e.tags).map((k: string) => {
            return {
              Key: k,
              Value: e.tags![k],
            };
          });
          clusterParams.Tags = tags;
        }

        const result = await this.createDBCluster(client.rdsClient, clusterParams);
        if (result) {
          // requery to get modified fields
          const newObject = await this.getDBCluster(client.rdsClient, e.dbClusterIdentifier);
          if (newObject) {
            const newEntity = await this.dbClusterMapper(newObject, ctx, e.region);
            if (!newEntity) continue;
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Set password as null to avoid infinite loop trying to update the password.
            // Reminder: Password need to be null since when we read RDS instances from AWS this
            // property is not retrieved
            newEntity.masterUserPassword = undefined;
            // Save the record back into the database to get the new fields updated
            await this.module.dbCluster.db.update(newEntity, ctx);
            out.push(newEntity);
          }
        }
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const enabledRegions = (await ctx.getEnabledAwsRegions()) as string[];
      if (id) {
        const { dbClusterIdentifier, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const rawCluster = await this.getDBCluster(client.rdsClient, dbClusterIdentifier);
        if (!rawCluster || rawCluster.Engine?.includes('aurora')) return;
        const result = await this.dbClusterMapper(rawCluster, ctx, region);
        return result;
      } else {
        const out: DBCluster[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const clusters = await this.getDBClusters(client.rdsClient);
            for (const cluster of clusters) {
              if (cluster.Engine.includes('aurora')) continue; // no support for aurora
              const c = await this.dbClusterMapper(cluster, ctx, region);
              if (!c) continue;
              out.push(c);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: DBCluster[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.DBCluster?.[this.entityId(e)];

        if (!e.vpcSecurityGroups?.filter(sg => !!sg.groupId).length)
          throw new Error('Waiting for security groups');

        // restore path
        if (
          !Object.is(e.engine, cloudRecord.engine) ||
          !Object.is(e.masterUsername, cloudRecord.masterUsername) ||
          !Object.is(e.publiclyAccessible, cloudRecord.publiclyAccessible) ||
          !Object.is(e.storageEncrypted, cloudRecord.storageEncrypted) ||
          !Object.is(e.subnetGroup?.name, cloudRecord.subnetGroup?.name) ||
          !Object.is(e.port, cloudRecord.port) ||
          !Object.is(e.arn, cloudRecord.arn)
        ) {
          cloudRecord.id = e.id;
          await this.module.dbCluster.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
          continue;
        }

        let isUpdate = false;

        // update db cluster tags
        if (e.arn && !eqTags(e.tags, cloudRecord.tags)) {
          await updateTags(client.rdsClient, e.arn, e.tags);
        }

        // update path
        const clusterParams: ModifyDBClusterCommandInput = {
          DBClusterIdentifier: e.dbClusterIdentifier,
          ApplyImmediately: true,
        };

        if (!Object.is(e.allocatedStorage, cloudRecord.allocatedStorage))
          clusterParams.AllocatedStorage = e.allocatedStorage;
        if (!Object.is(e.backupRetentionPeriod, cloudRecord.backupRetentionPeriod))
          clusterParams.BackupRetentionPeriod = e.backupRetentionPeriod;
        if (!Object.is(e.dbClusterInstanceClass, cloudRecord.dbClusterInstanceClass))
          clusterParams.DBClusterInstanceClass = e.dbClusterInstanceClass;
        if (clusterParams.DeletionProtection !== cloudRecord.deletionProtection)
          clusterParams.DeletionProtection = e.deletionProtection;
        if (!Object.is(e.engineVersion, cloudRecord.engineVersion))
          clusterParams.EngineVersion = e.engineVersion;
        if (!Object.is(e.iops, cloudRecord.iops)) clusterParams.Iops = e.iops;
        if (
          !Object.is(e.vpcSecurityGroups.length, cloudRecord.vpcSecurityGroups.length) &&
          (e.vpcSecurityGroups?.every(
            asg =>
              !!cloudRecord.vpcSecurityGroups.find((bsg: { groupId: any }) =>
                Object.is(asg.groupId, bsg.groupId),
              ),
          ) ??
            false)
        )
          clusterParams.VpcSecurityGroupIds =
            e.vpcSecurityGroups?.filter(sg => !!sg.groupId).map(sg => sg.groupId!) ?? [];

        // If a password value has been inserted, we update it.
        if (e.masterUserPassword) clusterParams.MasterUserPassword = e.masterUserPassword;

        if (Object.keys(clusterParams).length > 2) isUpdate = true; // 2 parameters are added by default, another one means update

        if (isUpdate) await this.updateDBCluster(client.rdsClient, clusterParams);
        // delete cache to force requery
        delete ctx.memo.cloud.DBCluster[this.entityId(e)];

        const newObject = await this.getDBCluster(client.rdsClient, e.dbClusterIdentifier);
        if (newObject) {
          const newEntity = await this.dbClusterMapper(newObject, ctx, e.region);
          if (!newEntity) continue;
          // We attach the original object's ID to this new one, indicating the exact record it is
          // replacing in the database.
          newEntity.id = e.id;
          // Set password as null to avoid infinite loop trying to update the password.
          // Reminder: Password need to be null since when we read RDS instances from AWS this
          // property is not retrieved
          newEntity.masterUserPassword = undefined;
          // Save the record back into the database to get the new fields updated
          await this.module.dbCluster.db.update(newEntity, ctx);
          out.push(newEntity);
        }
      }
      return out;
    },
    delete: async (es: DBCluster[], ctx: Context) => {
      let needsThrow = false;
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;

        // check if deletion protection is enabled and throw error
        if (e.deletionProtection) {
          needsThrow = true;
          continue;
        }
        await this.deleteDBCluster(client.rdsClient, {
          DBClusterIdentifier: e.dbClusterIdentifier,
          SkipFinalSnapshot: true,
        });
      }
      if (needsThrow)
        throw new Error(
          "Cannot delete a cluster with deletion protection. Please set the cluster's deletion protection to false and try again.",
        );
    },
  });

  constructor(module: AwsRdsModule) {
    super();
    this.module = module;
    super.init();
  }
}
