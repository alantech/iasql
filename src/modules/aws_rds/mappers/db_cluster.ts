import {
  RDS,
  DBCluster as AWSDBCluster,
  CreateDBClusterCommandInput,
  waitUntilDBClusterAvailable,
} from '@aws-sdk/client-rds';
import { WaiterOptions, WaiterState } from '@aws-sdk/util-waiter';

import { AwsRdsModule } from '..';
import { AWS, crudBuilderFormat } from '../../../services/aws_macros';
import { awsSecurityGroupModule } from '../../aws_security_group';
import { Context, Crud, MapperBase } from '../../interfaces';
import { DBCluster, dbClusterEngineEnum } from '../entity';

export class DBClusterMapper extends MapperBase<DBCluster> {
  module: AwsRdsModule;
  entity = DBCluster;
  equals = (a: DBCluster, b: DBCluster) =>
    Object.is(a.allocatedStorage, b.allocatedStorage) &&
    Object.is(a.backupRetentionPeriod, b.backupRetentionPeriod) &&
    Object.is(a.databaseName, b.databaseName) &&
    Object.is(a.dbClusterInstanceClass, b.dbClusterInstanceClass) &&
    Object.is(a.deletionProtection, b.deletionProtection) &&
    Object.is(a.engine, b.engine) &&
    Object.is(a.engineVersion, b.engineVersion) &&
    !a.masterUserPassword && // Special case, if master password defined, will update the password
    Object.is(a.masterUsername, b.masterUsername) &&
    Object.is(a.parameterGroup?.arn, b.parameterGroup?.arn) &&
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
    if (!cluster.DBClusterIdentifier) return undefined;
    out.allocatedStorage = cluster.AllocatedStorage;
    out.backupRetentionPeriod = cluster.BackupRetentionPeriod;
    out.databaseName = cluster.DatabaseName;
    out.dbClusterIdentifier = cluster.DBClusterIdentifier;
    out.dbClusterInstanceClass = cluster.DBClusterInstanceClass;
    out.deletionProtection = cluster.DeletionProtection ?? false;
    out.engine = cluster.Engine as dbClusterEngineEnum;
    if (cluster.EngineVersion) out.engineVersion = cluster.EngineVersion;
    out.masterUsername = cluster.MasterUsername;

    if (cluster.DBClusterParameterGroup) {
      out.parameterGroup =
        (await this.module.parameterGroup.db.read(
          ctx,
          this.module.parameterGroup.generateId({ name: cluster.DBClusterParameterGroup, region }),
        )) ??
        (await this.module.parameterGroup.cloud.read(
          ctx,
          this.module.parameterGroup.generateId({ name: cluster.DBClusterParameterGroup, region }),
        ));
    }
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
    out.region = region;

    out.vpcSecurityGroups = [];
    const vpcSecurityGroupIds = cluster?.VpcSecurityGroups?.filter(
      (vpcsg: any) => !!vpcsg?.VpcSecurityGroupId,
    ).map((vpcsg: any) => vpcsg?.VpcSecurityGroupId);

    for (const sgId of vpcSecurityGroupIds ?? []) {
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
    return result.state == WaiterState.SUCCESS;
  }

  getDBCluster = crudBuilderFormat<RDS, 'describeDBClusters', AWSDBCluster | undefined>(
    'describeDBClusters',
    DBClusterIdentifier => ({ DBClusterIdentifier }),
    res => res?.DBClusters?.[0],
  );

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
        const clusterParams: CreateDBClusterCommandInput = {
          AllocatedStorage: e.allocatedStorage,
          BackupRetentionPeriod: e.backupRetentionPeriod,
          DBClusterIdentifier: e.dbClusterIdentifier,
          DBClusterInstanceClass: e.dbClusterInstanceClass,
          DatabaseName: e.databaseName,
          DeletionProtection: e.deletionProtection,
          Engine: e.engine,
          EngineVersion: e.engineVersion,
          MasterUsername: e.masterUsername,
          MasterUserPassword: e.masterUserPassword,
          Port: e.port,
          PubliclyAccessible: e.publiclyAccessible,
          StorageEncrypted: e.storageEncrypted,
          VpcSecurityGroupIds: securityGroupIds,
        };
        if (e.parameterGroup) clusterParams.DBClusterParameterGroupName = e.parameterGroup.name;
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
        const { dbInstanceIdentifier, region } = this.idFields(id);
        const client = (await ctx.getAwsClient(region)) as AWS;
        const rawRds = await this.getDBInstance(client.rdsClient, dbInstanceIdentifier);
        if (!rawRds) return;
        return await this.rdsMapper(rawRds, ctx, region);
      } else {
        const out: RDS[] = [];
        await Promise.all(
          enabledRegions.map(async region => {
            const client = (await ctx.getAwsClient(region)) as AWS;
            const rdses = await this.getDBInstances(client.rdsClient);
            for (const rds of rdses) {
              const r = await this.rdsMapper(rds, ctx, region);
              if (!r) continue;
              out.push(r);
            }
          }),
        );
        return out;
      }
    },
    update: async (es: RDS[], ctx: Context) => {
      const out = [];
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const cloudRecord = ctx?.memo?.cloud?.RDS?.[this.entityId(e)];
        let updatedRecord = { ...cloudRecord };
        if (
          !(
            Object.is(e.dbInstanceClass, cloudRecord.dbInstanceClass) &&
            Object.is(e.engine, cloudRecord.engine) &&
            Object.is(e.allocatedStorage, cloudRecord.allocatedStorage) &&
            !e.masterUserPassword &&
            Object.is(e.vpcSecurityGroups.length, cloudRecord.vpcSecurityGroups.length) &&
            (e.vpcSecurityGroups?.every(
              esg => !!cloudRecord.vpcSecurityGroups.find((csg: any) => Object.is(esg.groupId, csg.groupId)),
            ) ??
              false)
          )
        ) {
          if (!e.vpcSecurityGroups?.filter(sg => !!sg.groupId).length) {
            throw new Error('Waiting for security groups');
          }
          const instanceParams: ModifyDBInstanceCommandInput = {
            DBInstanceClass: e.dbInstanceClass,
            EngineVersion: e.engine.split(':')[1],
            DBInstanceIdentifier: e.dbInstanceIdentifier,
            AllocatedStorage: e.allocatedStorage,
            VpcSecurityGroupIds: e.vpcSecurityGroups?.filter(sg => !!sg.groupId).map(sg => sg.groupId!) ?? [],
            BackupRetentionPeriod: e.backupRetentionPeriod,
            ApplyImmediately: true,
          };
          // If a password value has been inserted, we update it.
          if (e.masterUserPassword) {
            instanceParams.MasterUserPassword = e.masterUserPassword;
          }
          const result = await this.updateDBInstance(client.rdsClient, instanceParams);
          const dbInstance = await this.getDBInstance(client.rdsClient, result?.DBInstanceIdentifier ?? '');
          updatedRecord = await this.rdsMapper(dbInstance, ctx, e.region);
        }
        // Restore autogenerated values
        updatedRecord.id = e.id;
        // Set password as null to avoid infinite loop trying to update the password.
        // Reminder: Password need to be null since when we read RDS instances from AWS this
        // property is not retrieved
        updatedRecord.masterUserPassword = null;
        await this.module.rds.db.update(updatedRecord, ctx);
        out.push(updatedRecord);
      }
      return out;
    },
    delete: async (es: RDS[], ctx: Context) => {
      for (const e of es) {
        const client = (await ctx.getAwsClient(e.region)) as AWS;
        const input = {
          DBInstanceIdentifier: e.dbInstanceIdentifier,
          // TODO: do users will have access to this type of config?
          //        probably initially we should play it safe and do not create a snapshot
          //        and do not delete backups if any?
          SkipFinalSnapshot: true,
          // FinalDBSnapshotIdentifier: undefined,
          // DeleteAutomatedBackups: false,
        };
        await this.deleteDBInstance(client.rdsClient, input);
      }
    },
  });

  constructor(module: AwsRdsModule) {
    super();
    this.module = module;
    super.init();
  }
}
