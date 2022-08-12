import {
  CreateDBInstanceCommandInput,
  CreateDBParameterGroupCommandInput,
  DBParameterGroup,
  ModifyDBInstanceCommandInput,
  Parameter,
  RDS as AWSRDS,
  DescribeDBInstancesCommandInput,
  DBInstance,
  paginateDescribeDBInstances,
  DeleteDBInstanceMessage,
  paginateDescribeDBParameters,
  paginateDescribeDBParameterGroups,
} from '@aws-sdk/client-rds'
import { createWaiter, WaiterState } from '@aws-sdk/util-waiter'

import { AWS, crudBuilder2, crudBuilderFormat, paginateBuilder, mapLin, } from '../../../services/aws_macros'
import { ParameterGroup, ParameterGroupFamily, RDS, } from './entity'
import { Context, Crud2, MapperBase, ModuleBase, } from '../../interfaces'
import { AwsSecurityGroupModule, AwsVpcModule, } from '..'
import * as metadata from './module.json'

interface DBParameterGroupWParameters extends DBParameterGroup {
  Parameters:  Parameter[];
}

const getDBInstance = crudBuilderFormat<AWSRDS, 'describeDBInstances', DBInstance | undefined>(
  'describeDBInstances',
  (DBInstanceIdentifier) => ({ DBInstanceIdentifier, }),
  (res) => (res?.DBInstances ?? [])[0],
);
const getAllDBInstances = paginateBuilder<AWSRDS>(paginateDescribeDBInstances, 'DBInstances');
const getDBInstances = async (client: AWSRDS) => (await getAllDBInstances(client)).flat().filter(
  dbInstance => dbInstance.DBInstanceStatus === 'available'
);
const createDBParameterGroup = crudBuilderFormat<
  AWSRDS,
  'createDBParameterGroup',
  DBParameterGroup | undefined
>(
  'createDBParameterGroup',
  (input) => input,
  (res) => res?.DBParameterGroup,
);
const getSimpleDBParameterGroup = crudBuilderFormat<
  AWSRDS,
  'describeDBParameterGroups',
  DBParameterGroup | undefined
>(
  'describeDBParameterGroups',
  (DBParameterGroupName) => ({ DBParameterGroupName, }),
  (res) => (res?.DBParameterGroups ?? []).pop(),
);
const getDBParameterGroupParameters = paginateBuilder<AWSRDS>(
  paginateDescribeDBParameters,
  'Parameters',
  undefined,
  undefined,
  (DBParameterGroupName) => ({ DBParameterGroupName, }),
);
const getDBParameterGroup = async (client: AWSRDS, DBParameterGroupName: string) => {
  const simpleParameterGroup = await getSimpleDBParameterGroup(client, DBParameterGroupName);
  const Parameters = await getDBParameterGroupParameters(client, DBParameterGroupName);
  return { ...simpleParameterGroup, Parameters, };
};
const getSimpleDBParameterGroups = paginateBuilder<AWSRDS>(
  paginateDescribeDBParameterGroups,
  'DBParameterGroups',
);
const getDBParameterGroups = (client: AWSRDS) => mapLin(getSimpleDBParameterGroups(client), async (simpleParameterGroup: DBParameterGroup) => {
  const Parameters = await getDBParameterGroupParameters(client, simpleParameterGroup.DBParameterGroupName ?? '');
  return { ...simpleParameterGroup, Parameters, };
});
const modifyParameter = crudBuilder2<AWSRDS, 'modifyDBParameterGroup'>(
  'modifyDBParameterGroup',
  (DBParameterGroupName, parameter) => ({ DBParameterGroupName, Parameters: [parameter], }),
);
const deleteDBParameterGroup = crudBuilder2<AWSRDS, 'deleteDBParameterGroup'>(
  'deleteDBParameterGroup',
  (DBParameterGroupName) => ({ DBParameterGroupName, }),
);

// TODO: Make a waiter macro
async function createDBInstance(client: AWSRDS, instanceParams: CreateDBInstanceCommandInput) {
  let newDBInstance = (await client.createDBInstance(instanceParams)).DBInstance;
  const input: DescribeDBInstancesCommandInput = {
    DBInstanceIdentifier: instanceParams.DBInstanceIdentifier,
  };
  // TODO: should we use the paginator instead?
  await createWaiter<AWSRDS, DescribeDBInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 1200,
      minDelay: 1,
      maxDelay: 4,
    },
    input,
    async (cl, cmd) => {
      try {
        const data = await cl.describeDBInstances(cmd);
        for (const dbInstance of data?.DBInstances ?? []) {
          if (dbInstance.DBInstanceStatus !== 'available')
            return { state: WaiterState.RETRY };
          newDBInstance = dbInstance;
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        if (e.Code === 'InvalidInstanceID.NotFound')
          return { state: WaiterState.RETRY };
        throw e;
      }
    },
  );
  return newDBInstance;
}
async function updateDBInstance(client: AWSRDS, input: ModifyDBInstanceCommandInput) {
  let updatedDBInstance = (await client.modifyDBInstance(input))?.DBInstance;
  const inputCommand: DescribeDBInstancesCommandInput = {
    DBInstanceIdentifier: input.DBInstanceIdentifier,
  };
  await createWaiter<AWSRDS, DescribeDBInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 300,
      minDelay: 1,
      maxDelay: 4,
    },
    inputCommand,
    async (cl, cmd) => {
      try {
        const data = await cl.describeDBInstances(cmd);
        if (!data || !data.DBInstances?.length) return { state: WaiterState.RETRY };
        for (const dbInstance of data?.DBInstances ?? []) {
          if (dbInstance.DBInstanceStatus === 'available')
            return { state: WaiterState.RETRY };
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        if (e.Code === 'InvalidInstanceID.NotFound')
          return { state: WaiterState.RETRY };
        throw e;
      }
    },
  );
  await createWaiter<AWSRDS, DescribeDBInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 1200,
      minDelay: 1,
      maxDelay: 4,
    },
    inputCommand,
    async (cl, cmd) => {
      try {
        const data = await cl.describeDBInstances(cmd);
        if (!data || !data.DBInstances?.length) return { state: WaiterState.RETRY };
        for (const dbInstance of data?.DBInstances ?? []) {
          if (dbInstance.DBInstanceStatus !== 'available')
            return { state: WaiterState.RETRY };
          updatedDBInstance = dbInstance;
        }
        return { state: WaiterState.SUCCESS };
      } catch (e: any) {
        if (e.Code === 'InvalidInstanceID.NotFound')
          return { state: WaiterState.RETRY };
        throw e;
      }
    },
  );
  return updatedDBInstance;
}
async function deleteDBInstance(client: AWSRDS, deleteInput: DeleteDBInstanceMessage) {
  await client.deleteDBInstance(deleteInput);
  const cmdInput: DescribeDBInstancesCommandInput = {
    DBInstanceIdentifier: deleteInput.DBInstanceIdentifier,
  };
  await createWaiter<AWSRDS, DescribeDBInstancesCommandInput>(
    {
      client,
      // all in seconds
      maxWaitTime: 1200,
      minDelay: 1,
      maxDelay: 4,
    },
    cmdInput,
    async (cl, input) => {
      const data = await cl.describeDBInstances(input);
      for (const dbInstance of data?.DBInstances ?? []) {
        if (dbInstance.DBInstanceStatus === 'deleting')
          return { state: WaiterState.RETRY };
      }
      return { state: WaiterState.SUCCESS };
    },
  );
}

class RdsMapper extends MapperBase<RDS> {
  module: AwsRdsModule;
  entity = RDS;
  equals = (a: RDS, b: RDS) => Object.is(a.engine, b.engine)
    && Object.is(a.dbInstanceClass, b.dbInstanceClass)
    && Object.is(a.availabilityZone?.name, b.availabilityZone?.name)
    && Object.is(a.dbInstanceIdentifier, b.dbInstanceIdentifier)
    && Object.is(a.endpointAddr, b.endpointAddr)
    && Object.is(a.endpointHostedZoneId, b.endpointHostedZoneId)
    && Object.is(a.endpointPort, b.endpointPort)
    && !a.masterUserPassword  // Special case, if master password defined, will update the instance password
    && Object.is(a.masterUsername, b.masterUsername)
    && Object.is(a.vpcSecurityGroups.length, b.vpcSecurityGroups.length)
    && (a.vpcSecurityGroups?.every(asg => !!b.vpcSecurityGroups.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
    && Object.is(a.allocatedStorage, b.allocatedStorage)
    && Object.is(a.backupRetentionPeriod, b.backupRetentionPeriod)
    && Object.is(a.parameterGroup?.arn, b.parameterGroup?.arn);

  async rdsMapper(rds: any, ctx: Context) {
    const out = new RDS();
    out.allocatedStorage = rds?.AllocatedStorage;
    out.availabilityZone = await AwsVpcModule.mappers.availabilityZone.db.read(
      ctx,
      rds?.AvailabilityZone
    );
    out.dbInstanceClass = rds?.DBInstanceClass;
    out.dbInstanceIdentifier = rds?.DBInstanceIdentifier;
    out.endpointAddr = rds?.Endpoint?.Address;
    out.endpointHostedZoneId = rds?.Endpoint?.HostedZoneId;
    out.endpointPort = rds?.Endpoint?.Port;
    out.engine = `${rds?.Engine}:${rds?.EngineVersion}`;
    out.masterUsername = rds?.MasterUsername;
    const vpcSecurityGroupIds = rds?.VpcSecurityGroups?.filter((vpcsg: any) => !!vpcsg?.VpcSecurityGroupId).map((vpcsg: any) => vpcsg?.VpcSecurityGroupId);
    out.vpcSecurityGroups = [];
    for (const sgId of vpcSecurityGroupIds) {
      const sg = await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, sgId) ??
        await AwsSecurityGroupModule.mappers.securityGroup.cloud.read(ctx, sgId);
      if (sg) out.vpcSecurityGroups.push(sg);
    }
    out.backupRetentionPeriod = rds?.BackupRetentionPeriod ?? 1;
    if (rds.DBParameterGroups?.length) {
      const parameterGroup = rds.DBParameterGroups[0];
      out.parameterGroup = await this.module.parameterGroup.db.read(ctx, parameterGroup.DBParameterGroupName) ??
        await this.module.parameterGroup.cloud.read(ctx, parameterGroup.DBParameterGroupName);
    }
    return out;
  };

  cloud = new Crud2({
    create: async (es: RDS[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = [];
      for (const e of es) {
        const securityGroupIds = e.vpcSecurityGroups?.map(sg => {
          if (!sg.groupId) throw new Error('Security group needs to exist')
          return sg.groupId;
        }) ?? []
        const [Engine, EngineVersion] = e.engine.split(':');
        const instanceParams: CreateDBInstanceCommandInput = {
          DBInstanceIdentifier: e.dbInstanceIdentifier,
          DBInstanceClass: e.dbInstanceClass,
          Engine,
          EngineVersion,
          MasterUsername: e.masterUsername,
          MasterUserPassword: e.masterUserPassword,
          AllocatedStorage: e.allocatedStorage,
          VpcSecurityGroupIds: securityGroupIds,
          AvailabilityZone: e.availabilityZone.name,
          BackupRetentionPeriod: e.backupRetentionPeriod,
        };
        if (e.parameterGroup) {
          instanceParams.DBParameterGroupName = e.parameterGroup.name;
        }
        const result = await createDBInstance(client.rdsClient, instanceParams);
        // TODO: Handle if it fails (somehow)
        if (!result?.hasOwnProperty('DBInstanceIdentifier')) { // Failure
          throw new Error('what should we do here?');
        }
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await getDBInstance(client.rdsClient, result.DBInstanceIdentifier ?? '');
        // We need to update the parameter groups if its a default one and it does not exists
        const parameterGroupName = newObject?.DBParameterGroups?.[0].DBParameterGroupName;
        if (!(await this.module.parameterGroup.db.read(ctx, parameterGroupName))) {
          const cloudParameterGroup = await this.module.parameterGroup.cloud.read(ctx, parameterGroupName);
          await this.module.parameterGroup.db.create(cloudParameterGroup, ctx);
        }
        // We map this into the same kind of entity as `obj`
        const newEntity = await this.rdsMapper(newObject, ctx);
        // We attach the original object's ID to this new one, indicating the exact record it is
        // replacing in the database.
        newEntity.id = e.id;
        // Set password as null to avoid infinite loop trying to update the password.
        // Reminder: Password need to be null since when we read RDS instances from AWS this property is not retrieved
        newEntity.masterUserPassword = undefined;
        // Save the record back into the database to get the new fields updated
        await this.module.rds.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = await ctx.getAwsClient() as AWS;
      if (id) {
        const rawRds = await getDBInstance(client.rdsClient, id);
        if (!rawRds) return;
        return await this.rdsMapper(rawRds, ctx);
      } else {
        const rdses = (await getDBInstances(client.rdsClient));
        const out = [];
        for (const rds of rdses) {
          out.push(await this.rdsMapper(rds, ctx));
        }
        return out;
      }
    },
    updateOrReplace: () => 'update',
    update: async (es: RDS[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.RDS?.[e.dbInstanceIdentifier ?? ''];
        let updatedRecord = { ...cloudRecord };
        if (!(Object.is(e.dbInstanceClass, cloudRecord.dbInstanceClass)
          && Object.is(e.engine, cloudRecord.engine)
          && Object.is(e.allocatedStorage, cloudRecord.allocatedStorage)
          && !e.masterUserPassword
          && Object.is(e.vpcSecurityGroups.length, cloudRecord.vpcSecurityGroups.length)
          && (e.vpcSecurityGroups?.every(esg => !!cloudRecord.vpcSecurityGroups.find((csg: any) => Object.is(esg.groupId, csg.groupId))) ?? false))) {
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
          const result = await updateDBInstance(client.rdsClient, instanceParams);
          const dbInstance = await getDBInstance(client.rdsClient, result?.DBInstanceIdentifier ?? '');
          updatedRecord = await this.rdsMapper(dbInstance, ctx);
        }
        // Restore autogenerated values
        updatedRecord.id = e.id;
        // Set password as null to avoid infinite loop trying to update the password.
        // Reminder: Password need to be null since when we read RDS instances from AWS this property is not retrieved
        updatedRecord.masterUserPassword = null;
        await this.module.rds.db.update(updatedRecord, ctx);
        out.push(updatedRecord);
      }
      return out;
    },
    delete: async (es: RDS[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      for (const e of es) {
        const input = {
          DBInstanceIdentifier: e.dbInstanceIdentifier,
          // TODO: do users will have access to this type of config?
          //        probably initially we should play it safe and do not create a snapshot
          //        and do not delete backups if any?
          SkipFinalSnapshot: true,
          // FinalDBSnapshotIdentifier: undefined,
          // DeleteAutomatedBackups: false,
        };
        await deleteDBInstance(client.rdsClient, input);
      }
    },
  });

  constructor(module: AwsRdsModule) {
    super();
    this.module = module;
    super.init();
  }
}

class ParameterGroupMapper extends MapperBase<ParameterGroup> {
  module: AwsRdsModule;
  entity = ParameterGroup;
  equals = (a: ParameterGroup, b: ParameterGroup) => Object.is(a.arn, b.arn)
    && Object.is(a.family, b.family)
    && Object.is(a.description, b.description)
    && !this.getParametersNotEqual(a.parameters, b.parameters).length;

  parameterGroupMapper(pg: DBParameterGroupWParameters) {
    const out = new ParameterGroup();
    out.arn = pg?.DBParameterGroupArn;
    out.description = pg?.Description ?? '';
    out.family = pg.DBParameterGroupFamily as ParameterGroupFamily ?? '';
    out.name = pg.DBParameterGroupName ?? '';
    out.parameters = pg.Parameters;
    return out;
  };
  getParametersNotEqual(a: Parameter[] | undefined, b: Parameter[] | undefined) {
    if (!a && !b) return [];
    if (!a || !b) return [{} as Parameter];
    const parameters: Parameter[] = [];
    a?.forEach(ap => {
      const bParam = b?.find(bp => Object.is(ap.ParameterName, bp.ParameterName));
      if (!bParam || !(Object.is(ap.AllowedValues, bParam.AllowedValues)
        && Object.is(ap.ApplyMethod, bParam.ApplyMethod)
        && Object.is(ap.ApplyType, bParam.ApplyType)
        && Object.is(ap.DataType, bParam.DataType)
        && Object.is(ap.Description, bParam.Description)
        && Object.is(ap.IsModifiable, bParam.IsModifiable)
        && Object.is(ap.MinimumEngineVersion, bParam.MinimumEngineVersion)
        && Object.is(ap.ParameterValue, bParam.ParameterValue)
        && Object.is(ap.Source, bParam.Source))) {
          parameters.push(ap);
      }
    });
    return parameters;
  };

  cloud = new Crud2({
    create: async (es: ParameterGroup[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = [];
      for (const e of es) {
        const parameterGroupInput: CreateDBParameterGroupCommandInput = {
          DBParameterGroupName: e.name,
          DBParameterGroupFamily: e.family,
          Description: e.description,
        };
        const result = await createDBParameterGroup(client.rdsClient, parameterGroupInput);
        // Re-get the inserted record to get all of the relevant records we care about
        const newObject = await getDBParameterGroup(client.rdsClient, result?.DBParameterGroupName ?? '');
        // We map this into the same kind of entity as `obj`
        const newEntity = this.parameterGroupMapper(newObject);
        // Save the record back into the database to get the new fields updated
        await this.module.parameterGroup.db.update(newEntity, ctx);
        out.push(newEntity);
      }
      return out;
    },
    read: async (ctx: Context, id?: string) => {
      const client = await ctx.getAwsClient() as AWS;
      if (id) {
        const parameterGroup = await getDBParameterGroup(client.rdsClient, id);
        if (!parameterGroup) return;
        return this.parameterGroupMapper(parameterGroup);
      } else {
        const parameterGroups = await getDBParameterGroups(client.rdsClient);
        const out = [];
        for (const pg of parameterGroups) {
          out.push(this.parameterGroupMapper(pg));
        }
        return out;
      }
    },
    update: async (es: ParameterGroup[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      const out = [];
      for (const e of es) {
        const cloudRecord = ctx?.memo?.cloud?.ParameterGroup?.[e.name ?? ''];
        let updatedRecord = { ...cloudRecord };
        const parametersNotEqual = this.getParametersNotEqual(e.parameters, cloudRecord.parameters);
        let anyUpdate = false;
        for (const p of parametersNotEqual ?? []) {
          if (p.IsModifiable) {
            const parameterInput = {
              ParameterName: p.ParameterName,
              ParameterValue: p.ParameterValue,
              ApplyMethod: p.ApplyMethod,
            };
            await modifyParameter(client.rdsClient, e.name, parameterInput);
            anyUpdate = true;
          }
        }
        if (anyUpdate) {
          // Delete record from memo since we want a fresh read from cloud
          delete ctx?.memo?.cloud?.ParameterGroup?.[e.name ?? ''];
          updatedRecord = await this.module.parameterGroup.cloud.read(ctx, e.name);
        }
        await this.module.parameterGroup.db.update(updatedRecord, ctx);
        out.push(updatedRecord);
      }
      return out;
    },
    delete: async (es: ParameterGroup[], ctx: Context) => {
      const client = await ctx.getAwsClient() as AWS;
      for (const e of es) {
        // Default parameter groups cannot be deleted
        if (e.name.startsWith('default.')) {
          await this.module.parameterGroup.db.create(e, ctx);
        } else {
          await deleteDBParameterGroup(client.rdsClient, e.name);
        }
      }
    },
  });

  constructor(module: AwsRdsModule) {
    super();
    this.module = module;
    super.init();
  }
}

class AwsRdsModule extends ModuleBase {
  dependencies = metadata.dependencies;
  rds: RdsMapper;
  parameterGroup: ParameterGroupMapper;

  constructor() {
    super();
    this.rds = new RdsMapper(this);
    this.parameterGroup = new ParameterGroupMapper(this);
    super.init();
  }
}
export const awsRdsModule = new AwsRdsModule();
