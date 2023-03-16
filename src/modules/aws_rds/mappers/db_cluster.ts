import {
  RDS,
  DBCluster as AWSDBCluster,
  CreateDBClusterCommandInput,
  waitUntilDBClusterAvailable,
  paginateDescribeDBClusters,
  ModifyDBClusterCommandInput,
  DeleteDBClusterMessage,
  waitUntilDBClusterDeleted,
  waitUntilDBInstanceAvailable,
} from '@aws-sdk/client-rds';
import { WaiterOptions, WaiterState } from '@aws-sdk/util-waiter';

import { AwsRdsModule } from '..';
import { AWS, crudBuilderFormat, paginateBuilder } from '../../../services/aws_macros';
import { awsSecurityGroupModule } from '../../aws_security_group';
import { Context, Crud, MapperBase } from '../../interfaces';
import { DBCluster, dbClusterEngineEnum } from '../entity/db_cluster';
import supportedRegions from './supported_regions';

export class DBClusterMapper extends MapperBase<DBCluster> {
  module: AwsRdsModule;
  entity = DBCluster;
  equals = (a: DBCluster, b: DBCluster) =>
    Object.is(a.allocatedStorage, b.allocatedStorage) &&
    Object.is(a.iops, b.iops) &&
    Object.is(a.backupRetentionPeriod, b.backupRetentionPeriod) &&
    Object.is(a.dbClusterInstanceClass, b.dbClusterInstanceClass) &&
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

    return out;
  }

  async createDBCluster(client: RDS, clusterParams: CreateDBClusterCommandInput) {
    await client.createDBCluster(clusterParams);

    // wait until cluster is available
    const result = await waitUntilDBClusterAvailable(
      {
        client,
        // all in seconds
        maxWaitTime: 900,
        minDelay: 1,
        maxDelay: 4,
      } as WaiterOptions<RDS>,
      { DBClusterIdentifier: clusterParams.DBClusterIdentifier },
    );
    return result.state === WaiterState.SUCCESS;
  }

  async updateDBCluster(client: RDS, clusterParams: ModifyDBClusterCommandInput) {
    await client.modifyDBCluster(clusterParams);
    // wait until cluster and instances are available
    let result = await waitUntilDBClusterAvailable(
      {
        client,
        // all in seconds
        maxWaitTime: 900,
        minDelay: 1,
        maxDelay: 4,
      } as WaiterOptions<RDS>,
      { DBClusterIdentifier: clusterParams.DBClusterIdentifier },
    );
    if (result.state !== WaiterState.SUCCESS) return false;

    result = await waitUntilDBInstanceAvailable(
      {
        client,
        // all in seconds
        maxWaitTime: 900,
        minDelay: 1,
        maxDelay: 4,
      } as WaiterOptions<RDS>,
      { DBInstanceIdentifier: clusterParams.DBClusterIdentifier + '-instance-1' },
    );
    if (result.state !== WaiterState.SUCCESS) return false;
    return true;
  }

  async deleteDBCluster(client: RDS, deleteInput: DeleteDBClusterMessage) {
    await client.deleteDBCluster(deleteInput);
    // wait until cluster is deleted
    const result = await waitUntilDBClusterDeleted(
      {
        client,
        // all in seconds
        maxWaitTime: 900,
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
        if (supportedRegions.includes(region)) {
          const client = (await ctx.getAwsClient(region)) as AWS;
          const rawCluster = await this.getDBCluster(client.rdsClient, dbClusterIdentifier);
          if (!rawCluster || rawCluster.Engine?.includes('aurora')) return;
          const result = await this.dbClusterMapper(rawCluster, ctx, region);
          return result;
        }
      } else {
        const out: DBCluster[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            if (supportedRegions.includes(region)) {
              const client = (await ctx.getAwsClient(region)) as AWS;
              const clusters = await this.getDBClusters(client.rdsClient);
              for (const cluster of clusters) {
                if (cluster.Engine.includes('aurora')) continue; // no support for aurora
                const c = await this.dbClusterMapper(cluster, ctx, region);
                if (!c) continue;
                out.push(c);
              }
            }
          }),
        );
        return out;
      }
    },
    update: async (es: DBCluster[], ctx: Context) => {
      console.log('in update cluster');
      const out = [];
      for (const e of es) {
        console.log('i want to update');
        console.log(e);
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
          !Object.is(e.port, cloudRecord.port)
        ) {
          cloudRecord.id = e.id;
          await this.module.dbCluster.db.update(cloudRecord, ctx);
          out.push(cloudRecord);
          continue;
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
        if (!Object.is(e.deletionProtection, cloudRecord.deletion_protection))
          clusterParams.DeletionProtection = e.deletionProtection;
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
        console.log('i update');
        console.log(clusterParams);

        const result = await this.updateDBCluster(client.rdsClient, clusterParams);
        if (result) {
          // wait until cluster is available again
          console.log('after');
          // requery to get modified fields after waiting for cache expiration
          await new Promise(r => setTimeout(r, 41000));
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
            console.log('before db update');
            await this.module.dbCluster.db.update(newEntity, ctx);
            out.push(newEntity);
          }
        }
      }
      console.log('update results');
      console.log(out);
      return out;
    },
    delete: async (es: DBCluster[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        await this.deleteDBCluster(client.rdsClient, {
          DBClusterIdentifier: e.dbClusterIdentifier,
          SkipFinalSnapshot: true,
        });
      }
    },
  });

  constructor(module: AwsRdsModule) {
    super();
    this.module = module;
    super.init();
  }
}
