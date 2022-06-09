import { CreateDBInstanceCommandInput, CreateDBParameterGroupCommandInput, DBParameterGroup, ModifyDBInstanceCommandInput } from '@aws-sdk/client-rds'

import { AWS, } from '../../../services/gateways/aws'
import { Parameter, ParameterGroup, RDS, } from './entity'
import { Context, Crud2, Mapper2, Module2, } from '../../interfaces'
import { AwsSecurityGroupModule } from '..'
import * as metadata from './module.json'

export const AwsRdsModule: Module2 = new Module2({
  ...metadata,
  utils: {
    rdsMapper: async (rds: any, ctx: Context) => {
      const out = new RDS();
      out.allocatedStorage = rds?.AllocatedStorage;
      out.availabilityZone = rds?.AvailabilityZone;
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
        out.parameterGroup = await AwsRdsModule.mappers.parameterGroup.db.read(ctx, parameterGroup.DBParameterGroupName) ??
          await AwsRdsModule.mappers.parameterGroup.cloud.read(ctx, parameterGroup.DBParameterGroupName);
      }
      return out;
    },
    parameterGroupMapper: (pg: any) => {
      const out = new ParameterGroup();
      out.arn = pg?.DBParameterGroupArn;
      out.description = pg?.Description ?? '';
      out.family = pg.DBParameterGroupFamily ?? '';
      out.name = pg.DBParameterGroupName ?? '';
      out.parameters = pg.Parameters ?? [];
      return out;
    },
    parameterMapper: async (p: any, ctx: Context) => {
      const out = new Parameter();
      out.applyType = p.ApplyType;
      out.dataType = p.DataType;
      out.description = p.Description;
      out.isModifiable = p.IsModifiable;
      out.name = p.ParameterName;
      out.source = p.Source;
      out.value = p.AllowedValues;
      out.allowedValues = p.AllowedValues;
      out.applyMethod = p.ApplyMethod;
      out.minimumEngineVersion = p.MinimumEngineVersion;
      out.parameterGroup = await AwsRdsModule.mappers.parameterGroup.db.read(ctx, p.ParameterGroupName) ??
        await AwsRdsModule.mappers.parameterGroup.cloud.read(ctx, p.ParameterGroupName);
      return out;
    },
    parameterEquals: (a: Parameter, b: Parameter) => Object.is(a.allowedValues, b.allowedValues)
      && Object.is(a.applyMethod, b.applyMethod)
      && Object.is(a.applyType, b.applyType)
      && Object.is(a.dataType, b.dataType)
      && Object.is(a.description, b.description)
      && Object.is(a.isModifiable, b.isModifiable)
      && Object.is(a.minimumEngineVersion, b.minimumEngineVersion)
      && Object.is(a.name, b.name)
      && Object.is(a.parameterGroup?.arn, b.parameterGroup?.arn)
      && Object.is(a.source, b.source)
      && Object.is(a.value, b.value),
  },
  mappers: {
    rds: new Mapper2<RDS>({
      entity: RDS,
      equals: (a: RDS, b: RDS) => Object.is(a.engine, b.engine)
        && Object.is(a.dbInstanceClass, b.dbInstanceClass)
        && Object.is(a.availabilityZone, b.availabilityZone)
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
        && Object.is(a.parameterGroup?.arn, b.parameterGroup?.arn),
      source: 'db',
      cloud: new Crud2({
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
              AvailabilityZone: e.availabilityZone,
              BackupRetentionPeriod: e.backupRetentionPeriod,
            };
            if (e.parameterGroup) {
              instanceParams.DBParameterGroupName = e.parameterGroup.name;
            }
            const result = await client.createDBInstance(instanceParams);
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('DBInstanceIdentifier')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getDBInstance(result.DBInstanceIdentifier ?? '');
            // We need to update the parameter groups if its a default one and it does not exists
            const parameterGroupName = newObject.DBParameterGroups?.[0].DBParameterGroupName;
            if (!(await AwsRdsModule.mappers.parameterGroup.db.read(ctx, parameterGroupName))) {
              const cloudParameterGroup = await AwsRdsModule.mappers.parameterGroup.cloud.read(ctx, parameterGroupName);
              await AwsRdsModule.mappers.parameterGroup.db.create(cloudParameterGroup, ctx);
            }
            // We map this into the same kind of entity as `obj`
            const newEntity = await AwsRdsModule.utils.rdsMapper(newObject, ctx);
            // We attach the original object's ID to this new one, indicating the exact record it is
            // replacing in the database.
            newEntity.id = e.id;
            // Set password as null to avoid infinite loop trying to update the password.
            // Reminder: Password need to be null since when we read RDS instances from AWS this property is not retrieved
            newEntity.masterUserPassword = null;
            // Save the record back into the database to get the new fields updated
            await AwsRdsModule.mappers.rds.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const rawRds = await client.getDBInstance(id);
            if (!rawRds) return;
            return await AwsRdsModule.utils.rdsMapper(rawRds, ctx);
          } else {
            const rdses = (await client.getDBInstances()).DBInstances;
            const out = [];
            for (const rds of rdses) {
              out.push(await AwsRdsModule.utils.rdsMapper(rds, ctx));
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
              const result = await client.updateDBInstance(instanceParams);
              const dbInstance = await client.getDBInstance(result?.DBInstanceIdentifier ?? '');
              updatedRecord = await AwsRdsModule.utils.rdsMapper(dbInstance, ctx);
            }
            // Restore autogenerated values
            updatedRecord.id = e.id;
            // Set password as null to avoid infinite loop trying to update the password.
            // Reminder: Password need to be null since when we read RDS instances from AWS this property is not retrieved
            updatedRecord.masterUserPassword = null;
            await AwsRdsModule.mappers.rds.db.update(updatedRecord, ctx);
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
            await client.deleteDBInstance(input);
          }
        },
      }),
    }),
    parameterGroup: new Mapper2<ParameterGroup>({
      entity: ParameterGroup,
      equals: (a: ParameterGroup, b: ParameterGroup) => Object.is(a.arn, b.arn)
        && Object.is(a.family, b.family)
        && Object.is(a.description, b.description)
        && Object.is(a.parameters.length, b.parameters.length)
        && a.parameters.every(pa => !!b.parameters.find(pb => AwsRdsModule.utils.parameterEquals(pa, pb))),
      source: 'db',
      cloud: new Crud2({
        create: async (es: ParameterGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const parameterGroupInput: CreateDBParameterGroupCommandInput = {
              DBParameterGroupName: e.name,
              DBParameterGroupFamily: e.family,
              Description: e.description,
            };
            const result = await client.createDBParameterGroup(parameterGroupInput);
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getDBParameterGroup(result?.DBParameterGroupName ?? '');
            // Get parameters and insert them in DB
            const newObjectParameters = await client.getDBParameterGroupParameters(newObject?.DBParameterGroupName ?? '');
            const parameters = [];
            for (const p of newObjectParameters) {
              parameters.push(await AwsRdsModule.utils.parameterMapper(p, ctx));
            }
            const customObject = { ...newObject, Parameters: parameters };
            // We map this into the same kind of entity as `obj`
            const newEntity = AwsRdsModule.utils.parameterGroupMapper(customObject, ctx);
            // Save the record back into the database to get the new fields updated
            await AwsRdsModule.mappers.parameterGroup.db.update(newEntity, ctx);
            out.push(newEntity);
          }
          return out;
        },
        read: async (ctx: Context, id?: string) => {
          const client = await ctx.getAwsClient() as AWS;
          if (id) {
            const parameterGroup = await client.getDBParameterGroup(id);
            if (!parameterGroup) return;
            // Get parameters
            const objectParameters = await client.getDBParameterGroupParameters(parameterGroup?.DBParameterGroupName ?? '');
            const parameters = [];
            for (const p of objectParameters) {
              parameters.push(await AwsRdsModule.utils.parameterMapper(p, ctx));
            }
            return AwsRdsModule.utils.parameterGroupMapper({ ...parameterGroup, parameters }, ctx);
          } else {
            const parameterGroups = await client.getDBParameterGroups();
            const out = [];
            for (const pg of parameterGroups) {
              // Get parameters
              const objectParameters = await client.getDBParameterGroupParameters(pg?.DBParameterGroupName ?? '');
              const parameters = [];
              for (const p of objectParameters) {
                parameters.push(await AwsRdsModule.utils.parameterMapper(p, ctx));
              }
              out.push(AwsRdsModule.utils.parameterGroupMapper({ ...pg, Parameters: parameters, }, ctx));
            }
            return out;
          }
        },
        update: async (es: ParameterGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const out = [];
          for (const e of es) {
            const cloudRecord = ctx?.memo?.cloud?.ParameterGroup?.[e.name ?? ''];
            const parametersToModify = [];
            for (const pcr of cloudRecord.parameters) {
              if (!e.parameters.find(pe => AwsRdsModule.utils.parameterEquals(pcr, pe)) && pcr.isModifiable) {
                parametersToModify.push(pcr);
              }
            }
            if (parametersToModify.length) {
              const parametersInput = [];
              for (const p of parametersToModify) {
                parametersInput.push({
                  ParameterName: p.name,
                  ParameterValue: p.value,
                  ApplyMethod: p.applyMethod,
                });
              }
              await client.modifyParameters(e.name, parametersInput);
              // Get parameters
              const objectParameters = await client.getDBParameterGroupParameters(e.name ?? '');
              const parameters = [];
              for (const p of objectParameters) {
                parameters.push(await AwsRdsModule.utils.parameterMapper(p, ctx));
              }
              // Attach ids manually
              for (let p of cloudRecord.parameters) {
                const relevantParam = parameters.find(param => Object.is(param.name, p.name));
                relevantParam.id = p.id;
                p = relevantParam;
              }
              cloudRecord.parameters = parameters;
          }
            await AwsRdsModule.mappers.rds.db.update(cloudRecord, ctx);
            out.push(cloudRecord);
          }
          return out;
        },
        delete: async (es: ParameterGroup[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          for (const e of es) {
            await client.deleteDBParameterGroup(e.name);
          }
        },
      }),
    }),
  },
}, __dirname);
