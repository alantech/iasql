import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import { RDS, EngineVersion, } from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { AwsAccount, AwsSecurityGroupModule } from '..'
import { awsRds1638273752147 } from './migration/1638273752147-aws_rds'
import { ModifyDBInstanceCommandInput } from '@aws-sdk/client-rds'

export const AwsRdsModule: Module = new Module({
  name: 'aws_rds',
  dependencies: ['aws_account', 'aws_security_group',],
  provides: {
    entities: allEntities,
    tables: ['engine_version', 'rds',],
    functions: ['create_rds',],
  },
  utils: {
    engineVersionMapper: (e: any, _ctx: Context) => {
      const out = new EngineVersion();
      out.engine = e.Engine;
      out.engineVersion = e.EngineVersion;
      out.engineVersionKey = `${e.Engine}:${e.EngineVersion}`;
      return out;
    },
    rdsMapper: async (rds: any, ctx: Context) => {
      const out = new RDS();
      out.allocatedStorage = rds?.AllocatedStorage;
      out.availabilityZone = await AwsAccount.mappers.availabilityZone.db.read(ctx, rds.AvailabilityZone) ??
        await AwsAccount.mappers.availabilityZone.cloud.read(ctx, rds.AvailabilityZone);
      out.dbInstanceClass = rds?.DBInstanceClass;
      out.dbInstanceIdentifier = rds?.DBInstanceIdentifier;
      out.endpointAddr = rds?.Endpoint?.Address;
      out.endpointHostedZoneId = rds?.Endpoint?.HostedZoneId;
      out.endpointPort = rds?.Endpoint?.Port;
      const rdsEngineVersionKey = `${rds?.Engine}:${rds?.EngineVersion}`;
      out.engine = await AwsRdsModule.mappers.engineVersion.db.read(ctx, rdsEngineVersionKey) ??
        await AwsRdsModule.mappers.engineVersion.cloud.read(ctx, rdsEngineVersionKey);
      if (!out.engine) throw new Error('Engine versions need to be loaded first')
      out.masterUsername = rds?.MasterUsername;
      const vpcSecurityGroupIds = rds?.VpcSecurityGroups?.filter((vpcsg: any) => !!vpcsg?.VpcSecurityGroupId).map((vpcsg: any) => vpcsg?.VpcSecurityGroupId);
      out.vpcSecurityGroups = vpcSecurityGroupIds ?
        await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, vpcSecurityGroupIds) ??
          await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx, vpcSecurityGroupIds)
        : [];
      return out;
    },
  },
  mappers: {
    engineVersion: new Mapper<EngineVersion>({
      entity: EngineVersion,
      entityId: (e: EngineVersion) => e?.engineVersionKey ?? '',
      // TODO: source: cloud entityPrint not needed (yet)
      entityPrint: (e: EngineVersion) => ({
        id: e.id?.toString() ?? '',
      }),
      equals: (_a: EngineVersion, _b: EngineVersion) => true,
      source: 'cloud',
      db: new Crud({
        create: (e: EngineVersion[], ctx: Context) => ctx.orm.save(EngineVersion, e),
        read: async (ctx: Context, ids?: string[]) => {
          const opts = ids ? {
            where: {
              engineVersionKey: In(ids),
            },
          } : undefined;
          return await ctx.orm.find(EngineVersion, opts);
        },
        update: (e: EngineVersion[], ctx: Context) => ctx.orm.save(EngineVersion, e),
        delete: (e: EngineVersion[], ctx: Context) => ctx.orm.remove(EngineVersion, e),
      }),
      cloud: new Crud({
        create: async (_e: EngineVersion[], _ctx: Context) => { /** Noop */ },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const evs = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getEngineVersion(id))) :
            (await client.getEngineVersions()).DBEngineVersions;
          // TODO: Remove this once we have a better handle on making sure the AWS API returns
          // unique data
          const evIdx: any = {};
          evs.forEach((ev: any) => evIdx[ev.EngineVersionKey] = ev);
          const evs2 = Object.values(evIdx);
          return await Promise.all(evs2.map(ev => AwsRdsModule.utils.engineVersionMapper(ev, ctx)));
        },
        update: async (_e: EngineVersion[], _ctx: Context) => {/** Noop */ },
        delete: async (_e: EngineVersion[], _ctx: Context) => {/** Noop */ },
      }),
    }),
    rds: new Mapper<RDS>({
      entity: RDS,
      entityId: (e: RDS) => e.dbInstanceIdentifier ?? '',
      entityPrint: (e: RDS) => ({
        id: e?.id?.toString() ?? '',
        dbInstanceIdentifier: e?.dbInstanceIdentifier ?? '',
        allocatedStorage: e?.allocatedStorage?.toString() ?? '',
        dbInstanceClass: e?.dbInstanceClass ?? '',
        engine: e?.engine?.engine ?? '',
        masterUserPassword: e?.masterUserPassword ?? '',
        masterUsername: e?.masterUsername ?? '',
        vpcSecurityGroups: e?.vpcSecurityGroups?.map(sg => sg.groupName ?? '').join(', ') ?? '',
        endpointAddr: e?.endpointAddr ?? '',
        endpointPort: e?.endpointPort?.toString() ?? '',
        endpointHostedZoneId: e?.endpointHostedZoneId ?? '',
      }),
      equals: (a: RDS, b: RDS) => {
        
        if (!Object.is(a.engine.engineVersionKey, b.engine.engineVersionKey)) console.log('1')
        if (!Object.is(a.dbInstanceClass, b.dbInstanceClass)) console.log('2')
        if (!Object.is(a.availabilityZone?.zoneId, b.availabilityZone?.zoneId)) console.log('3')
        if (!Object.is(a.dbInstanceIdentifier, b.dbInstanceIdentifier)) console.log('4')
        if (!Object.is(a.endpointAddr, b.endpointAddr)) console.log('5')
        if (!Object.is(a.endpointHostedZoneId, b.endpointHostedZoneId)) console.log('6')
        if (!Object.is(a.endpointPort, b.endpointPort)) console.log('7')
        if (!!a.masterUserPassword  ) console.log('8')
        if (!Object.is(a.masterUsername, b.masterUsername)) console.log('9')
        if (!Object.is(a.vpcSecurityGroups.length, b.vpcSecurityGroups.length)) console.log('10')
        if (!(a.vpcSecurityGroups?.every(asg => !!b.vpcSecurityGroups.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)) console.log('11')
        if (!Object.is(a.allocatedStorage, b.allocatedStorage)) console.log('12')

        const res = Object.is(a.engine.engineVersionKey, b.engine.engineVersionKey)
        && Object.is(a.dbInstanceClass, b.dbInstanceClass)
        && Object.is(a.availabilityZone?.zoneId, b.availabilityZone?.zoneId)
        && Object.is(a.dbInstanceIdentifier, b.dbInstanceIdentifier)
        && Object.is(a.endpointAddr, b.endpointAddr)
        && Object.is(a.endpointHostedZoneId, b.endpointHostedZoneId)
        && Object.is(a.endpointPort, b.endpointPort)
        && !a.masterUserPassword  // Special case, if master password defined, will update the instance password
        && Object.is(a.masterUsername, b.masterUsername)
        && Object.is(a.vpcSecurityGroups.length, b.vpcSecurityGroups.length)
        && (a.vpcSecurityGroups?.every(asg => !!b.vpcSecurityGroups.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
        && Object.is(a.allocatedStorage, b.allocatedStorage);

        if (!res) {
          console.dir({eqres: res}, {depth:4});
        }
        return res;
      },
      // equals: (a: RDS, b: RDS) => Object.is(a.engine.engineVersionKey, b.engine.engineVersionKey)
      //   && Object.is(a.dbInstanceClass, b.dbInstanceClass)
      //   && Object.is(a.availabilityZone?.zoneId, b.availabilityZone?.zoneId)
      //   && Object.is(a.dbInstanceIdentifier, b.dbInstanceIdentifier)
      //   && Object.is(a.endpointAddr, b.endpointAddr)
      //   && Object.is(a.endpointHostedZoneId, b.endpointHostedZoneId)
      //   && Object.is(a.endpointPort, b.endpointPort)
      //   && !a.masterUserPassword  // Special case, if master password defined, will update the instance password
      //   && Object.is(a.masterUsername, b.masterUsername)
      //   && Object.is(a.vpcSecurityGroups.length, b.vpcSecurityGroups.length)
      //   && (a.vpcSecurityGroups?.every(asg => !!b.vpcSecurityGroups.find(bsg => Object.is(asg.groupId, bsg.groupId))) ?? false)
      //   && Object.is(a.allocatedStorage, b.allocatedStorage),
      source: 'db',
      db: new Crud({
        create: (rds: RDS[], ctx: Context) => ctx.orm.save(RDS, rds),
        read: async (ctx: Context, ids?: string[]) => {
          const relations = ['engine', 'vpcSecurityGroups', 'availabilityZone'];
          const opts = ids ? {
            where: {
              dbInstanceIdentifier: In(ids),
            },
            relations,
          } : { relations, };
          return await ctx.orm.find(RDS, opts);
        },
        update: async (rds: RDS[], ctx: Context) => { await ctx.orm.save(RDS, rds); },
        delete: async (rds: RDS[], ctx: Context) => { await ctx.orm.remove(RDS, rds); },
      }),
      cloud: new Crud({
        create: async (es: RDS[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const securityGroupIds = e.vpcSecurityGroups?.map(sg => {
              if (!sg.groupId) throw new Error('Security group needs to exist')
              return sg.groupId;
            }) ?? []
            const instanceParams = {
              DBInstanceIdentifier: e.dbInstanceIdentifier,
              DBInstanceClass: e.dbInstanceClass,
              Engine: e.engine.engine,
              EngineVersion: e.engine.engineVersion,
              MasterUsername: e.masterUsername,
              MasterUserPassword: e.masterUserPassword,
              AllocatedStorage: e.allocatedStorage,
              VpcSecurityGroupIds: securityGroupIds,
              AvailabilityZone: e.availabilityZone.zoneName,
            }
            const result = await client.createDBInstance(instanceParams);
            // TODO: Handle if it fails (somehow)
            if (!result?.hasOwnProperty('DBInstanceIdentifier')) { // Failure
              throw new Error('what should we do here?');
            }
            // Re-get the inserted record to get all of the relevant records we care about
            const newObject = await client.getDBInstance(result.DBInstanceIdentifier ?? '');
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
            return newEntity;
          }));
        },
        read: async (ctx: Context, ids?: string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          const rdses = Array.isArray(ids) ?
            await Promise.all(ids.map(id => client.getDBInstance(id))) :
            (await client.getDBInstances()).DBInstances;
          return await Promise.all(rdses.map(rds => AwsRdsModule.utils.rdsMapper(rds, ctx)));
        },
        updateOrReplace: () => 'update',
        update: async (es: RDS[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          return await Promise.all(es.map(async (e) => {
            const cloudRecord = ctx?.memo?.cloud?.RDS?.[e.dbInstanceIdentifier ?? ''];
            let updatedRecord = { ...cloudRecord };
            if (!(Object.is(e.dbInstanceClass, cloudRecord.dbInstanceClass)
              && Object.is(e.engine.engineVersionKey, cloudRecord.engine.engineVersionKey)
              && Object.is(e.allocatedStorage, cloudRecord.allocatedStorage)
              && !e.masterUserPassword
              && Object.is(e.vpcSecurityGroups.length, cloudRecord.vpcSecurityGroups.length)
              && (e.vpcSecurityGroups?.every(esg => !!cloudRecord.vpcSecurityGroups.find((csg: any) => Object.is(esg.groupId, csg.groupId))) ?? false))) {
              const instanceParams: ModifyDBInstanceCommandInput = {
                DBInstanceClass: e.dbInstanceClass,
                EngineVersion: e.engine.engineVersion,
                DBInstanceIdentifier: e.dbInstanceIdentifier,
                AllocatedStorage: e.allocatedStorage,
                VpcSecurityGroupIds: e.vpcSecurityGroups?.filter(sg => !!sg.groupId).map(sg => sg.groupId!) ?? [],
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
            return updatedRecord;
          }));
        },
        delete: async (es: RDS[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          await Promise.all(es.map(async (e) => {
            const input = {
              DBInstanceIdentifier: e.dbInstanceIdentifier,
              // TODO: do users will have access to this type of config?
              //        probably initially we should play it safe and do not create a snapshot
              //        and do not delete backups if any?
              SkipFinalSnapshot: true,
              // FinalDBSnapshotIdentifier: undefined,
              // DeleteAutomatedBackups: false,
            };
            return client.deleteDBInstance(input);
          }));
        },
      }),
    }),
  },
  migrations: {
    postinstall: awsRds1638273752147.prototype.up,
    preremove: awsRds1638273752147.prototype.down,
  },
});
