import { In, } from 'typeorm'

import { AWS, } from '../../services/gateways/aws'
import { RDS, EngineVersion, } from './entity'
import * as allEntities from './entity'
import { Context, Crud, Mapper, Module, } from '../interfaces'
import { AwsAccount, AwsSecurityGroupModule } from '..'
import { AvailabilityZone } from '../aws_account/entity'
import { AwsSecurityGroup } from '../aws_security_group/entity'
import { awsRds1638273752147 } from './migration/1638273752147-aws_rds'
import { DepError } from '../../services/lazy-dep'

export const AwsRdsModule: Module = new Module({
  name: 'aws_rds',
  dependencies: ['aws_account', 'aws_security_group',],
  provides: {
    entities: allEntities,
    tables: ['engine_version', 'rds',],
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
      const availabilityZones = ctx.memo?.db?.AvailabilityZone ? Object.values(ctx.memo?.db?.AvailabilityZone) : await AwsAccount.mappers.availabilityZone.db.read(ctx);
      out.availabilityZone = availabilityZones.find((z: any) => z.zoneName === rds?.AvailabilityZone) as AvailabilityZone;
      out.dbInstanceClass = rds?.DBInstanceClass;
      out.dbInstanceIdentifier = rds?.DBInstanceIdentifier;
      out.endpointAddr = rds?.Endpoint?.Address;
      out.endpointHostedZoneId = rds?.Endpoint?.HostedZoneId;
      out.endpointPort = rds?.Endpoint?.Port;
      const engineVersions = ctx.memo?.db?.EngineVersion ? Object.values(ctx.memo?.db?.EngineVersion) : await AwsRdsModule.mappers.engineVersion.db.read(ctx);
      if (!engineVersions?.length) throw new DepError('Engine versions need to be loaded first')
      out.engine = engineVersions.find((ev: any) => ev.engineVersionKey === `${rds?.Engine}:${rds?.EngineVersion}`) as EngineVersion;
      out.masterUsername = rds?.MasterUsername;
      const securityGroups = ctx.memo?.db?.AwsSecurityGroup ? Object.values(ctx.memo?.db?.AwsSecurityGroup) : await AwsSecurityGroupModule.mappers.securityGroup.db.read(ctx);
      out.vpcSecurityGroups = rds?.VpcSecurityGroups?.map((sg: any) => securityGroups.find((g: any) => g.groupId === sg.groupId) as AwsSecurityGroup);
      return out;
    },
  },
  mappers: {
    engineVersion: new Mapper<EngineVersion>({
      entity: EngineVersion,
      entityId: (e: EngineVersion) => e?.engineVersionKey ?? '',
      equals: (_a: EngineVersion, _b: EngineVersion) => true,
      source: 'cloud',
      db: new Crud({
        create: async (e: EngineVersion | EngineVersion[], ctx: Context) => { await ctx.orm.save(EngineVersion, e); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const opts = id ? {
            where: {
              engineVersionKey: Array.isArray(id) ? In(id) : id,
            },
          } : undefined;
          return (!id || Array.isArray(id)) ? await ctx.orm.find(EngineVersion, opts) : await ctx.orm.findOne(EngineVersion, opts);
        },
        update: async (e: EngineVersion | EngineVersion[], ctx: Context) => { await ctx.orm.save(EngineVersion, e); },
        delete: async (e: EngineVersion | EngineVersion[], ctx: Context) => { await ctx.orm.remove(EngineVersion, e); },
      }),
      cloud: new Crud({
        create: async (_e: EngineVersion | EngineVersion[], _ctx: Context) => { /** Noop */ },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsRdsModule.utils.engineVersionMapper(
                  await client.getEngineVersion(id), ctx
                );
              }));
            } else {
              return await AwsRdsModule.utils.engineVersionMapper(
                await client.getEngineVersion(ids), ctx
              );
            }
          } else {
            const engineVersions = (await client.getEngineVersions())?.DBEngineVersions ?? [];
            return await Promise.all(
              engineVersions.filter(e => e.Engine === 'postgres').map((e: any) => AwsRdsModule.utils.engineVersionMapper(e, ctx))
            );
          }
        },
        update: async (_e: EngineVersion | EngineVersion[], _ctx: Context) => {/** Noop */ },
        delete: async (_e: EngineVersion | EngineVersion[], _ctx: Context) => {/** Noop */ },
      }),
    }),
    rds: new Mapper<RDS>({
      entity: RDS,
      entityId: (e: RDS) => e.dbInstanceIdentifier + '',
      equals: (a: RDS, b: RDS) => Object.is(a.engine.engineVersionKey, b.engine.engineVersionKey)
        && Object.is(a.dbInstanceClass, b.dbInstanceClass)
        && Object.is(a.allocatedStorage, b.allocatedStorage),
      source: 'db',
      db: new Crud({
        create: async (rds: RDS | RDS[], ctx: Context) => { await ctx.orm.save(RDS, rds); },
        read: async (ctx: Context, id?: string | string[] | undefined) => {
          const relations = ['engine', 'vpcSecurityGroups', 'availabilityZone'];
          const opts = id ? {
            where: {
              dbInstanceIdentifier: Array.isArray(id) ? In(id) : id,
            },
            relations,
          } : { relations, };
          return (!id || Array.isArray(id)) ? await ctx.orm.find(RDS, opts) : await ctx.orm.findOne(RDS, opts);
        },
        update: async (rds: RDS | RDS[], ctx: Context) => { await ctx.orm.save(RDS, rds); },
        delete: async (rds: RDS | RDS[], ctx: Context) => { await ctx.orm.remove(RDS, rds); },
      }),
      cloud: new Crud({
        create: async (rds: RDS | RDS[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(rds) ? rds : [rds];
          const out = await Promise.all(es.map(async (e) => {
            const instanceParams = {
              DBInstanceIdentifier: e.dbInstanceIdentifier,
              DBInstanceClass: e.dbInstanceClass,
              Engine: e.engine.engine,
              EngineVersion: e.engine.engineVersion,
              MasterUsername: e.masterUsername,
              MasterUserPassword: e.masterUserPassword,
              AllocatedStorage: e.allocatedStorage,
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
            // TODO: save password with bcrypt?
            // Clean password
            newEntity.masterUserPassword = null;
            // Save the record back into the database to get the new fields updated
            await AwsRdsModule.mappers.rds.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(rds)) {
            return out;
          } else {
            return out[0];
          }
        },
        read: async (ctx: Context, ids?: string | string[]) => {
          const client = await ctx.getAwsClient() as AWS;
          if (ids) {
            if (Array.isArray(ids)) {
              return await Promise.all(ids.map(async (id) => {
                return await AwsRdsModule.utils.rdsMapper(
                  await client.getDBInstance(id), ctx
                );
              }));
            } else {
              return await AwsRdsModule.utils.rdsMapper(
                await client.getDBInstance(ids), ctx
              );
            }
          } else {
            const dbInstances = (await client.getDBInstances())?.DBInstances ?? [];
            return await Promise.all(
              dbInstances.map((rds: any) => AwsRdsModule.utils.rdsMapper(rds, ctx))
            );
          }
        },
        update: async (rds: RDS | RDS[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(rds) ? rds : [rds];
          const out = await Promise.all(es.map(async (e) => {
            // Doing an actual update of some of the properties that can change.
            // Discarded delete + re-create for two reasons
            // 1. Db identifier should be unique and is the one defined by the user. We could update the current one
            //    with a temporary name (which could cause a diff later while is not deleted yet?) create the new one with the old name and then delete.
            // 2. In order to create a new RDS instance is necessary a MasterPassword. The first insertion of the RDS instance have the master password plain text,
            //    it creates the instance and then remove the value from DB since it does not come on the AWS response. For the update we do not know which password use
            //    so we should need to ask for a password field for every update?
            const instanceParams: any = {
              DBInstanceClass: e.dbInstanceClass,
              EngineVersion: e.engine.engineVersion,
              DBInstanceIdentifier: e.dbInstanceIdentifier,
              AllocatedStorage: e.allocatedStorage,
              ApplyImmediately: true,
            };
            // If a password value has been inserted, we update it.
            if (e.masterUserPassword) {
              instanceParams.MasterUserPassword = e.masterUserPassword;
            }
            const result = await client.updateDBInstance(instanceParams);
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
            // TODO: save password with bcrypt?
            // Clean password
            newEntity.masterUserPassword = null;
            // Save the record back into the database to get the new fields updated
            await AwsRdsModule.mappers.rds.db.update(newEntity, ctx);
            return newEntity;
          }));
          // Make sure the dimensionality of the returned data matches the input
          if (Array.isArray(rds)) {
            return out;
          } else {
            return out[0];
          }
        },
        delete: async (rds: RDS | RDS[], ctx: Context) => {
          const client = await ctx.getAwsClient() as AWS;
          const es = Array.isArray(rds) ? rds : [rds];
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
            await client.deleteDBInstance(input);
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
