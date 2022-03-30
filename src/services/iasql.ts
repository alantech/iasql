import { promisify, } from 'util'
import { exec as execNode, } from 'child_process'
const exec = promisify(execNode);

import { createConnection, } from 'typeorm'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'
import { snakeCase, } from 'typeorm/util/StringUtils'

import { DepError, lazyLoader, } from '../services/lazy-dep'
import { findDiff, } from '../services/diff'
import MetadataRepo from './repositories/metadata'
import { TypeormWrapper, } from './typeorm'
import { IasqlModule, IasqlTables, } from '../entity'
import { sortModules, } from './mod-sort'
import * as dbMan from './db-manager'
import * as Modules from '../modules'
import * as scheduler from './scheduler'
import { IasqlDatabase } from '../metadata/entity';
import { AWS } from './gateways/aws';
import logger, { debugObj } from './logger';

// Crupde = CR-UP-DE, Create/Update/Delete
type Crupde = { [key: string]: { id: string, description: string, }[], };
export function recordCount(records: { [key: string]: any, }[]): [number, number, number] {
  const dbCount = records.reduce((cumu, r) => cumu + r.diff.entitiesInDbOnly.length, 0);
  const cloudCount = records.reduce((cumu, r) => cumu + r.diff.entitiesInAwsOnly.length, 0);
  const bothCount = records.reduce((cumu, r) => cumu + r.diff.entitiesChanged.length, 0);
  return [ dbCount, cloudCount, bothCount, ];
}
const iasqlPlanV3 = (
  toCreate: Crupde,
  toUpdate: Crupde,
  toReplace: Crupde,
  toDelete: Crupde,
) => JSON.stringify({
  iasqlPlanVersion: 3,
  rows: (() => {
    const out: any[] = [];
    Object.keys(toCreate).forEach(tbl => {
      const recs = toCreate[tbl];
      recs.forEach(rec => out.push({ action: 'create', tableName: snakeCase(tbl), ...rec, }));
    });
    Object.keys(toUpdate).forEach(tbl => {
      const recs = toUpdate[tbl];
      recs.forEach(rec => out.push({ action: 'update', tableName: snakeCase(tbl), ...rec, }));
    });
    Object.keys(toReplace).forEach(tbl => {
      const recs = toReplace[tbl];
      recs.forEach(rec => out.push({ action: 'replace', tableName: snakeCase(tbl), ...rec, }));
    });
    Object.keys(toDelete).forEach(tbl => {
      const recs = toDelete[tbl];
      recs.forEach(rec => out.push({ action: 'delete', tableName: snakeCase(tbl), ...rec, }));
    });
    return out;
  })(),
});

export async function connect(
  dbAlias: string,
  awsRegion: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  uid: string,
  email: string,
) {
  let conn1: any, conn2: any, dbId: any, dbUser: any;
  let orm: TypeormWrapper | undefined;
  try {
    logger.info('Creating account for user...');
    const dbGen = dbMan.genUserAndPass();
    dbUser = dbGen[0];
    const dbPass = dbGen[1];
    dbId = dbMan.genDbId(dbAlias);
    await MetadataRepo.saveDb(uid, email, dbAlias, dbId, dbUser, awsRegion);
    logger.info('Establishing DB connections...');
    conn1 = await createConnection(dbMan.baseConnConfig);
    await conn1.query(`
      CREATE DATABASE ${dbId};
    `);
    // wait for the scheduler to start and register its migrations before ours so that the stored procedures
    // that use the scheduler's schema succeed
    await scheduler.start(dbId, dbUser);
    conn2 = await createConnection({
      ...dbMan.baseConnConfig,
      name: dbId,
      database: dbId,
    });
    await dbMan.migrate(conn2);
    const queryRunner = conn2.createQueryRunner();
    await Modules.AwsAccount.migrations.install?.(queryRunner);
    logger.info('Adding aws_account@0.0.1 schema...');
    // TODO: Use the entity for this in the future?
    await conn2.query(`
      INSERT INTO iasql_module VALUES ('aws_account@0.0.1')
    `);
    await conn2.query(`
      INSERT INTO aws_account (access_key_id, secret_access_key, region) VALUES ('${awsAccessKeyId}', '${awsSecretAccessKey}', '${awsRegion}')
    `);
    logger.info('Loading aws_account data...');
    // Manually load the relevant data from the cloud side for the `aws_account` module.
    // TODO: Figure out how to eliminate *most* of this special-casing for this module in the future
    const entities: Function[] = Object.values(Modules.AwsAccount.mappers).map(m => m.entity);
    entities.push(IasqlModule);
    entities.push(IasqlTables);
    orm = await TypeormWrapper.createConn(dbId, {entities} as PostgresConnectionOptions);
    const mappers = Object.values(Modules.AwsAccount.mappers);
    const context: Modules.Context = { orm, memo: {}, ...Modules.AwsAccount.provides.context, };
    for (const mapper of mappers) {
      logger.info(`Loading aws_account table ${mapper.entity.name}...`);
      const e = await mapper.cloud.read(context);
      if (!e || (Array.isArray(e) && !e.length)) {
        logger.info(`${mapper.entity.name} has no records in the cloud to store`);
      } else {
        // Since we manually inserted a half-broken record into `region` above, we need extra logic
        // here to make sure the newly-acquired records are properly inserted/updated in the DB. The
        // logic here is made generic for all mappers in `aws_account` in case we decide to do this
        // for other tables in the future above and not have it break unexpectedly.
        const existingRecords: any[] = await orm.find(mapper.entity);
        const existingIds = existingRecords.map((er: any) => mapper.entityId(er));
        for (const entity of e) {
          if (existingRecords.length > 0) {
            const id = mapper.entityId(entity);
            if (existingIds.includes(id)) {
              const ind = existingRecords.findIndex((_er, i) => existingIds[i] === id);
              entity.id = existingRecords[ind].id;
            }
          }
          await mapper.db.create(entity, context);
        }
      }
    }
    await conn2.query(dbMan.newPostgresRoleQuery(dbUser, dbPass, dbId));
    await conn2.query(dbMan.grantPostgresRoleQuery(dbUser));
    logger.info('Done!');
    return {
      alias: dbAlias,
      id: dbId,
      user: dbUser,
      password: dbPass,
    };
  } catch (e: any) {
    // delete db in psql and metadata in IP
    await conn1?.query(`DROP DATABASE IF EXISTS ${dbId} WITH (FORCE);`);
    if (dbUser) await conn1?.query(dbMan.dropPostgresRoleQuery(dbUser));
    await MetadataRepo.delDb(uid, dbAlias);
    // rethrow the error
    throw e;
  } finally {
    await conn1?.close();
    await conn2?.close();
    await orm?.dropConn();
  }
}

export async function disconnect(dbAlias: string, uid: string) {
  let conn;
  try {
    const db: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    scheduler.stop(db.pgName);
    conn = await createConnection(dbMan.baseConnConfig);
    await conn.query(`
      DROP DATABASE ${db.pgName} WITH (FORCE);
    `);
    await conn.query(dbMan.dropPostgresRoleQuery(db.pgUser));
    await MetadataRepo.delDb(uid, dbAlias);
    return `disconnected ${dbAlias}`;
  } catch (e: any) {
    // re-throw
    throw e;
  } finally {
    conn?.close();
  }
}

export async function list(uid: string, email: string, verbose = false) {
  try {
    const dbs = await MetadataRepo.getDbs(uid, email);
    if (verbose) return dbs;
    return dbs.map(db => db.alias);
  } catch (e: any) {
    throw e;
  }
}

export async function dump(dbAlias: string, uid: any, dataOnly: boolean) {
  let dbId;
  try {
    const db: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    dbId = db.pgName;
  } catch (e: any) {
    throw e;
  }
  const pgUrl = dbMan.ourPgUrl(dbId);
  const excludedDataTables = '--exclude-table-data \'aws_account\' --exclude-table-data \'iasql_*\''
  const { stdout, } = await exec(
    `pg_dump ${
      dataOnly ?
        `--data-only --no-privileges --column-inserts --rows-per-insert=50 --on-conflict-do-nothing ${excludedDataTables}`
        :
        ''
    } --inserts --exclude-schema=graphile_worker -x ${pgUrl}`,
    { shell: '/bin/bash', }
  );
  return stdout;
}

// TODO revive and test
/*export async function load(
  dumpStr: string,
  dbAlias: string,
  awsRegion: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  user: any,
) {
  let conn1, conn2, dbId, dbUser;
  try {
    console.log('Creating account for user...');
    const dbGen = dbMan.genUserAndPass();
    dbUser = dbGen[0];
    const dbPass = dbGen[1];
    const meta = await dbMan.setMetadata(dbAlias, dbUser, user);
    dbId = meta.dbId;
    console.log('Establishing DB connections...');
    conn1 = await createConnection(dbMan.baseConnConfig);
    await conn1.query(`CREATE DATABASE ${dbId};`);
    conn2 = await createConnection({
      ...dbMan.baseConnConfig,
      name: dbId,
      database: dbId,
    });
    // Restore dump and wrap it in a try catch
    // that drops the database on error
    console.log('Restoring schema and data from dump...');
    await conn2.query(dumpStr);
    // Update aws_account schema
    await conn2.query(`
      UPDATE public.aws_account
      SET access_key_id = '${awsAccessKeyId}', secret_access_key = '${awsSecretAccessKey}', region = '${awsRegion}'
      WHERE id = 1;
    `);
    // Grant permissions
    await conn2.query(dbMan.newPostgresRoleQuery(dbUser, dbPass, dbId));
    await conn2.query(dbMan.grantPostgresRoleQuery(dbUser));
    console.log('Done!');
    return {
      alias: dbAlias,
      id: dbId,
      user: dbUser,
      password: dbPass,
    };
  } catch (e: any) {
    // delete db in psql and metadata in IP
    await conn1?.query(`DROP DATABASE IF EXISTS ${dbId} WITH (FORCE);`);
    await conn1?.query(`
      DROP ROLE IF EXISTS ${dbUser};
    `);
    await dbMan.delMetadata(dbAlias, user);
    // rethrow the error
    throw e;
  } finally {
    await conn1?.close();
    await conn2?.close();
  }
}*/

function colToRow(cols: { [key: string]: any[], }): { [key: string]: any, }[] {
  // Assumes equal length for all arrays
  const keys = Object.keys(cols);
  const out: { [key: string]: any, }[] = [];
  for (let i = 0; i < cols[keys[0]].length; i++) {
    const row: { [key: string]: any, } = {};
    for (const key of keys) {
      row[key] = cols[key][i];
    }
    out.push(row);
  }
  return out;
}

export async function apply(dbId: string, dryRun: boolean, ormOpt?: TypeormWrapper) {
  const t1 = Date.now();
  logger.info(`Applying ${dbId}`);
  let orm: TypeormWrapper | null = null;
  try {
    orm = !ormOpt ? await TypeormWrapper.createConn(dbId) : ormOpt;
    // Find all of the installed modules, and create the context object only for these
    const moduleNames = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
    const memo: any = {}; // TODO: Stronger typing here
    const context: Modules.Context = { orm, memo, }; // Every module gets access to the DB
    for (const name of moduleNames) {
      const mod = (Object.values(Modules) as Modules.Module[]).find(m => `${m.name}@${m.version}` === name) as Modules.Module;
      if (!mod) throw new Error(`This should be impossible. Cannot find module ${name}`);
      const moduleContext = mod.provides.context ?? {};
      Object.keys(moduleContext).forEach(k => context[k] = moduleContext[k]);
    }
    // Get the relevant mappers, which are the ones where the DB is the source-of-truth
    const mappers = (Object.values(Modules) as Modules.ModuleInterface[])
      .filter(mod => moduleNames.includes(`${mod.name}@${mod.version}`))
      .map(mod => Object.values((mod as Modules.ModuleInterface).mappers))
      .flat()
      .filter(mapper => mapper.source === 'db');
    const t2 = Date.now();
    logger.info(`Setup took ${t2 - t1}ms`);
    let ranFullUpdate = false;
    let failureCount = -1;
    const toCreate: Crupde = {};
    const toUpdate: Crupde = {};
    const toReplace: Crupde = {};
    const toDelete: Crupde = {};
    let dbCount = -1;
    let cloudCount = -1;
    let bothCount = -1;
    let spinCount = 0;
    do {
      ranFullUpdate = false;
      const tables = mappers.map(mapper => mapper.entity.name);
      memo.db = {}; // Flush the DB entities on the outer loop to restore the actual intended state
      await lazyLoader(mappers.map(mapper => async () => {
        await mapper.db.read(context);
      }));
      const comparators = mappers.map(mapper => mapper.equals);
      const idGens = mappers.map(mapper => mapper.entityId);
      let ranUpdate = false;
      do {
        ranUpdate = false;
        memo.cloud = {}; // Flush the Cloud entities on the inner loop to track changes to the state
        await lazyLoader(mappers.map(mapper => async () => {
          await mapper.cloud.read(context);
        }));
        const t3 = Date.now();
        logger.info(`Record acquisition time: ${t3 - t2}ms`);
        const records = colToRow({
          table: tables,
          mapper: mappers,
          dbEntity: tables.map(t => memo.db[t] ? Object.values(memo.db[t]) : []),
          cloudEntity: tables.map(t => memo.cloud[t] ? Object.values(memo.cloud[t]) : []),
          comparator: comparators,
          idGen: idGens,
        });
        const t4 = Date.now();
        logger.info(`AWS Mapping time: ${t4 - t3}ms`);
        if (!records.length) { // Only possible on just-created databases
          return JSON.stringify({
            iasqlPlanVersion: 3,
            rows: [],
          });
        }
        const updatePlan = (
          crupde: Crupde,
          entityName: string,
          mapper: Modules.MapperInterface<any>,
          es: any[]
        ) => {
          crupde[entityName] = crupde[entityName] ?? [];
          const rs = es.map((e: any) => ({
            id: e?.id?.toString() ?? '',
            description: mapper.entityId?.(e) ?? '',
          }));
          rs.forEach(r => {
            if (!crupde[entityName]
              .some(r2 => Object.is(r2.id, r.id) && Object.is(r2.description, r.description))
            ) crupde[entityName].push(r);
          });
        }
        records.forEach(r => {
          r.diff = findDiff(r.dbEntity, r.cloudEntity, r.idGen, r.comparator);
          if (r.diff.entitiesInDbOnly.length > 0) {
            updatePlan(toCreate, r.table, r.mapper, r.diff.entitiesInDbOnly);
          }
          if (r.diff.entitiesInAwsOnly.length > 0) {
            updatePlan(toDelete, r.table, r.mapper, r.diff.entitiesInAwsOnly);
          }
          if (r.diff.entitiesChanged.length > 0) {
            const updates: any[] = [];
            const replaces: any[] = [];
            r.diff.entitiesChanged.forEach((e: any) => {
              const isUpdate = r.mapper.cloud.updateOrReplace(e.cloud, e.db) === 'update';
              if (isUpdate) {
                updates.push(e.db);
              } else {
                replaces.push(e.db);
              }
            });
            if (updates.length > 0) updatePlan(toUpdate, r.table, r.mapper, updates);
            if (replaces.length > 0) updatePlan(toReplace, r.table, r.mapper, replaces);
          }
        });
        if (dryRun) return iasqlPlanV3(toCreate, toUpdate, toReplace, toDelete);
        const [ nextDbCount, nextCloudCount, nextBothCount, ] = recordCount(records);
        if (
          dbCount === nextDbCount &&
          cloudCount === nextCloudCount &&
          bothCount === nextBothCount
        ) {
          spinCount++;
        } else {
          dbCount = nextDbCount;
          cloudCount = nextCloudCount;
          bothCount = nextBothCount;
          spinCount = 0;
        }
        if (spinCount === 4) {
          throw new DepError('Forward progress halted. All remaining DB changes failing to apply.', {
            toCreate,
            toUpdate,
            toReplace,
            toDelete,
          });
        }
        const t5 = Date.now();
        logger.info(`Diff time: ${t5 - t4}ms`);
        const promiseGenerators = records
          .map(r => {
            const name = r.table;
            logger.info(`Checking ${name}`);
            const outArr = [];
            if (r.diff.entitiesInDbOnly.length > 0) {
              logger.info(`${name} has records to create`);
              outArr.push(r.diff.entitiesInDbOnly.map((e: any) => async () => {
                const out = await r.mapper.cloud.create(e, context);
                if (out) {
                  const es = Array.isArray(out) ? out : [out];
                  es.forEach(e2 => {
                    // Mutate the original entity with the returned entity's properties so the actual
                    // record created is what is compared the next loop through
                    Object.keys(e2).forEach(k => e[k] = e2[k]);
                  });
                }
              }));
            }
            if (r.diff.entitiesChanged.length > 0) {
              logger.info(`${name} has records to update`);
              outArr.push(r.diff.entitiesChanged.map((ec: any) => async () => {
                const out = await r.mapper.cloud.update(ec.db, context); // Assuming SoT is the DB
                if (out) {
                  const es = Array.isArray(out) ? out : [out];
                  es.forEach(e2 => {
                    // Mutate the original entity with the returned entity's properties so the actual
                    // record created is what is compared the next loop through
                    Object.keys(e2).forEach(k => ec.db[k] = e2[k]);
                  });
                }
              }));
            }
            if (r.diff.entitiesInAwsOnly.length > 0) {
              logger.info(`${name} has records to delete`);
              outArr.push(r.diff.entitiesInAwsOnly.map((e: any) => async () => {
                await r.mapper.cloud.delete(e, context);
              }));
            }
            return outArr;
          })
          .flat(9001);
        if (promiseGenerators.length > 0) {
          ranUpdate = true;
          ranFullUpdate = true;
          try {
            await lazyLoader(promiseGenerators);
          } catch (e: any) {
            if (failureCount === e.metadata?.generatorsToRun?.length) throw e;
            failureCount = e.metadata?.generatorsToRun?.length;
            ranUpdate = false;
          }
          const t6 = Date.now();
          logger.info(`AWS update time: ${t6 - t5}ms`);
        }
      } while(ranUpdate);
    } while (ranFullUpdate);
    const t7 = Date.now();
    logger.info(`${dbId} applied and synced, total time: ${t7 - t1}ms`);
    return iasqlPlanV3(toCreate, toUpdate, toReplace, toDelete);
  } catch (e: any) {
    debugObj(e);
    throw e;
  } finally {
    // do not drop the conn if it was provided
    if (orm !== ormOpt) orm?.dropConn();
  }
}

export async function sync(dbId: string, dryRun: boolean, ormOpt?: TypeormWrapper) {
  const t1 = Date.now();
  logger.info(`Syncing ${dbId}`);
  let orm: TypeormWrapper | null = null;
  try {
    orm = !ormOpt ? await TypeormWrapper.createConn(dbId) : ormOpt;
    // Find all of the installed modules, and create the context object only for these
    const moduleNames = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
    const memo: any = {}; // TODO: Stronger typing here
    const context: Modules.Context = { orm, memo, }; // Every module gets access to the DB
    for (const name of moduleNames) {
      const mod = (Object.values(Modules) as Modules.Module[]).find(m => `${m.name}@${m.version}` === name) as Modules.Module;
      if (!mod) throw new Error(`This should be impossible. Cannot find module ${name}`);
      const moduleContext = mod.provides.context ?? {};
      Object.keys(moduleContext).forEach(k => context[k] = moduleContext[k]);
    }
    // Get the mappers, regardless of source-of-truth
    const mappers = (Object.values(Modules) as Modules.ModuleInterface[])
      .filter(mod => moduleNames.includes(`${mod.name}@${mod.version}`))
      .map(mod => Object.values((mod as Modules.ModuleInterface).mappers))
      .flat();
    const t2 = Date.now();
    logger.info(`Setup took ${t2 - t1}ms`);
    let ranFullUpdate = false;
    let failureCount = -1;
    const toCreate: Crupde = {};
    const toUpdate: Crupde = {};
    const toReplace: Crupde = {}; // Not actually used in sync mode, at least right now
    const toDelete: Crupde = {};
    let dbCount = -1;
    let cloudCount = -1;
    let bothCount = -1;
    let spinCount = 0;
    do {
      ranFullUpdate = false;
      const tables = mappers.map(mapper => mapper.entity.name);
      memo.cloud = {}; // Flush the cloud entities on the outer loop to restore the actual intended state
      await lazyLoader(mappers.map(mapper => async () => {
        await mapper.cloud.read(context);
      }));
      const comparators = mappers.map(mapper => mapper.equals);
      const idGens = mappers.map(mapper => mapper.entityId);
      let ranUpdate = false;
      do {
        ranUpdate = false;
        memo.db = {}; // Flush the DB entities on the inner loop to track changes to the state
        await lazyLoader(mappers.map(mapper => async () => {
          await mapper.db.read(context);
        }));
        const t3 = Date.now();
        logger.info(`Record acquisition time: ${t3 - t2}ms`);
        const records = colToRow({
          table: tables,
          mapper: mappers,
          dbEntity: tables.map(t => memo.db[t] ? Object.values(memo.db[t]) : []),
          cloudEntity: tables.map(t => memo.cloud[t] ? Object.values(memo.cloud[t]) : []),
          comparator: comparators,
          idGen: idGens,
        });
        const t4 = Date.now();
        logger.info(`AWS Mapping time: ${t4 - t3}ms`);
        if (!records.length) { // Only possible on just-created databases
          return JSON.stringify({
            iasqlPlanVersion: 3,
            rows: [],
          });
        }
        const updatePlan = (
          crupde: Crupde,
          entityName: string,
          mapper: Modules.MapperInterface<any>,
          es: any[]
        ) => {
          crupde[entityName] = crupde[entityName] ?? [];
          const rs = es.map((e: any) => ({
            id: e?.id?.toString() ?? '',
            description: mapper.entityId?.(e) ?? '',
          }));
          rs.forEach(r => {
            if (!crupde[entityName]
              .some(r2 => Object.is(r2.id, r.id) && Object.is(r2.description, r.description))
            ) crupde[entityName].push(r);
          });
        }
        records.forEach(r => {
          r.diff = findDiff(r.dbEntity, r.cloudEntity, r.idGen, r.comparator);
          if (r.diff.entitiesInDbOnly.length > 0) {
            updatePlan(toDelete, r.table, r.mapper, r.diff.entitiesInDbOnly);
          }
          if (r.diff.entitiesInAwsOnly.length > 0) {
            updatePlan(toCreate, r.table, r.mapper, r.diff.entitiesInAwsOnly);
          }
          if (r.diff.entitiesChanged.length > 0) {
            const updates: any[] = [];
            r.diff.entitiesChanged.forEach((e: any) => {
              updates.push(e.cloud);
            });
            if (updates.length > 0) updatePlan(toUpdate, r.table, r.mapper, updates);
          }
        });
        if (dryRun) return iasqlPlanV3(toCreate, toUpdate, toReplace, toDelete);
        const [ nextDbCount, nextCloudCount, nextBothCount, ] = recordCount(records);
        if (
          dbCount === nextDbCount &&
          cloudCount === nextCloudCount &&
          bothCount === nextBothCount
        ) {
          spinCount++;
        } else {
          dbCount = nextDbCount;
          cloudCount = nextCloudCount;
          bothCount = nextBothCount;
          spinCount = 0;
        }
        if (spinCount === 4) {
          throw new DepError('Forward progress halted. All remaining Cloud changes failing to apply.', {
            toCreate,
            toUpdate,
            toReplace,
            toDelete,
          });
        }
        const t5 = Date.now();
        logger.info(`Diff time: ${t5 - t4}ms`);
        const promiseGenerators = records
          .map(r => {
            const name = r.table;
            logger.info(`Checking ${name}`);
            const outArr = [];
            if (r.diff.entitiesInAwsOnly.length > 0) {
              logger.info(`${name} has records to create`);
              outArr.push(r.diff.entitiesInAwsOnly.map((e: any) => async () => {
                const out = await r.mapper.db.create(e, context);
                if (out) {
                  const es = Array.isArray(out) ? out : [out];
                  es.forEach(e2 => {
                    // Mutate the original entity with the returned entity's properties so the actual
                    // record created is what is compared the next loop through
                    Object.keys(e2).forEach(k => e[k] = e2[k]);
                  });
                }
              }));
            }
            if (r.diff.entitiesChanged.length > 0) {
              logger.info(`${name} has records to update`);
              outArr.push(r.diff.entitiesChanged.map((ec: any) => async () => {
                ec.cloud.id = ec.db.id;
                const out = await r.mapper.db.update(ec.cloud, context); // When `sync`ing we assume SoT is the Cloud
                if (out) {
                  const es = Array.isArray(out) ? out : [out];
                  es.forEach(e2 => {
                    // Mutate the original entity with the returned entity's properties so the actual
                    // record created is what is compared the next loop through
                    Object.keys(e2).forEach(k => ec.cloud[k] = e2[k]);
                  });
                }
              }));
            }
            if (r.diff.entitiesInDbOnly.length > 0) {
              logger.info(`${name} has records to delete`);
              outArr.push(r.diff.entitiesInDbOnly.map((e: any) => async () => {
                await r.mapper.db.delete(e, context);
              }));
            }
            return outArr;
          })
          .flat(9001);
        if (promiseGenerators.length > 0) {
          ranUpdate = true;
          ranFullUpdate = true;
          try {
            await lazyLoader(promiseGenerators);
          } catch (e: any) {
            if (failureCount === e.metadata?.generatorsToRun?.length) throw e;
            failureCount = e.metadata?.generatorsToRun?.length;
            ranUpdate = false;
          }
          const t6 = Date.now();
          logger.info(`AWS update time: ${t6 - t5}ms`);
        }
      } while(ranUpdate);
    } while (ranFullUpdate);
    const t7 = Date.now();
    logger.info(`${dbId} synced, total time: ${t7 - t1}ms`);
    return iasqlPlanV3(toCreate, toUpdate, toReplace, toDelete);
  } catch (e: any) {
    debugObj(e);
    throw e;
  } finally {
    // do not drop the conn if it was provided
    if (orm !== ormOpt) orm?.dropConn();
  }
}

export async function modules(all: boolean, installed: boolean, dbId: string) {
  // TODO rm special casing for aws_account
  const allModules = Object.values(Modules)
    .filter(m => m.hasOwnProperty('mappers') && m.hasOwnProperty('name') && m.name !== 'aws_account')
    .map((m: any) => ({
      moduleName: m.name,
      moduleVersion: m.version,
      dependencies: m.dependencies.filter((d: any) => d !== 'aws_account@0.0.1'),
    }));
  if (all) {
    return JSON.stringify(allModules);
  } else if (installed && dbId) {
    const entities: Function[] = [IasqlModule, IasqlTables];
    const orm = await TypeormWrapper.createConn(dbId, {entities} as PostgresConnectionOptions);
    const mods = await orm.find(IasqlModule);
    const modsInstalled = mods.map((m: IasqlModule) => (m.name));
    return JSON.stringify(allModules.filter(m => modsInstalled.includes(m.moduleName)));
  } else {
    throw new Error('Invalid request parameters');
  }
}

export async function install(moduleList: string[], dbId: string, dbUser: string, allModules = false, ormOpt?: TypeormWrapper) {
  // Check to make sure that all specified modules actually exist
  if (allModules) {
    moduleList = (Object.values(Modules) as Modules.ModuleInterface[]).filter((m: Modules.ModuleInterface) => m.name && m.version && m.name !== 'aws_account' ).map((m: Modules.ModuleInterface) => `${m.name}@${m.version}`);
  }
  const mods = moduleList.map((n: string) => (Object.values(Modules) as Modules.Module[]).find(m => `${m.name}@${m.version}` === n)) as Modules.Module[];
  if (mods.some((m: any) => m === undefined)) {
    throw new Error(`The following modules do not exist: ${
      moduleList.filter((n: string) => !(Object.values(Modules) as Modules.ModuleInterface[]).find(m => `${m.name}@${m.version}` === n)).join(', ')
    }`);
  }
  const orm = !ormOpt ? await TypeormWrapper.createConn(dbId) : ormOpt;
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already installed and prune them from the list
  const existingModules = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
  for (let i = 0; i < mods.length; i++) {
    if (existingModules.includes(mods[i].name)) {
      mods.splice(i, 1);
      i--;
    }
  }
  // TODO rm special casing for aws_account
  // Check to make sure that all dependent modules are in the list
  const missingDeps = mods
    .flatMap((m: Modules.Module) => m.dependencies.filter(d => !moduleList.includes(d) && !existingModules.includes(d)))
    .filter((m: any) => m !== 'aws_account@0.0.1' && m !== undefined);
  if (missingDeps.length > 0) {
    throw new Error(`The provided modules depend on the following modules that are not provided or installed: ${
      missingDeps.join(', ')
    }`);
  }
  // See if we need to abort because now there's nothing to do
  if (mods.length === 0) {
    throw new Error("All modules already installed");
  }
  // Scan the database and see if there are any collisions
  const tables = (await queryRunner.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
  `)).map((t: any) => t.table_name);
  const tableCollisions: { [key: string]: string[], } = {};
  let hasCollision = false;
  for (const md of mods) {
    tableCollisions[md.name] = [];
    if (md.provides?.tables) {
      for (const t of md.provides.tables) {
        if (tables.includes(t)) {
          tableCollisions[md.name].push(t);
          hasCollision = true;
        }
      }
    }
  }
  if (hasCollision) {
    throw new Error(`Collision with existing tables detected.
${Object.keys(tableCollisions)
.filter(m => tableCollisions[m].length > 0)
.map(m => `Module ${m} collides with tables: ${tableCollisions[m].join(', ')}`)
.join('\n')
}`);
  }
  // We're now good to go with installing the requested modules. To make sure they install correctly
  // we first need to sync the existing modules to make sure there are no records the newly-added
  // modules have a dependency on.
  try {
    await sync(dbId, false, orm);
  } catch (e: any) {
    logger.error('Sync during module install failed', e);
    throw e;
  }
  // Sort the modules based on their dependencies, with both root-to-leaf order and vice-versa
  const rootToLeafOrder = sortModules(mods, existingModules);
  // Actually run the installation. The install scripts are run from root-to-leaf. Wrapped in a
  // transaction so any failure at this point when we're actually mutating the database doesn't leave things in a busted state.
  await queryRunner.startTransaction();
  try {
    for (const md of rootToLeafOrder) {
      if (md.migrations?.install) {
        await md.migrations.install(queryRunner);
      }
      const e = new IasqlModule();
      e.name = `${md.name}@${md.version}`;
      e.dependencies = await Promise.all(
        md.dependencies.map(async (dep) => await orm.findOne(IasqlModule, { name: dep, }))
      );
      await orm.save(IasqlModule, e);

      const modTables = md.provides.tables?.map((t) => {
        const mt = new IasqlTables();
        mt.table = t;
        mt.module = e;
        return mt;
      }) ?? [];
      await orm.save(IasqlTables, modTables);
    }
    await queryRunner.commitTransaction();
    await orm.query(dbMan.grantPostgresRoleQuery(dbUser));
  } catch (e: any) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
  // For all newly installed modules, query the cloud state, if any, and save it to the database.
  // Since the context requires all installed modules and that has changed, for simplicity's sake
  // we're re-loading the modules and constructing the context that way, first, but then iterating
  // through the mappers of only the newly installed modules to sync from cloud to DB.
  // TODO: For now we're gonna use the TypeORM client directly, but we should be using `db.create`,
  // but we aren't right now because it would be slower. Need to figure out if/how to change the
  // mapper to make batch create/update/delete more efficient.

  // Find all of the installed modules, and create the context object only for these
  const moduleNames = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
  const context: Modules.Context = { orm, memo: {}, }; // Every module gets access to the DB
  for (const name of moduleNames) {
    const md = (Object.values(Modules) as Modules.Module[]).find(m => `${m.name}@${m.version}` === name) as Modules.Module;
    if (!md) throw new Error(`This should be impossible. Cannot find module ${name}`);
    const moduleContext = md.provides.context ?? {};
    Object.keys(moduleContext).forEach(k => context[k] = moduleContext[k]);
  }

  try {
    for (const md of rootToLeafOrder) {
      // Get the relevant mappers, which are the ones where the DB is the source-of-truth
      const mappers = Object.values(md.mappers);
      await lazyLoader(mappers.map(mapper => async () => {
        let e;
        try {
          e = await mapper.cloud.read(context);
        } catch (err: any) {
          logger.error(`Error reading from cloud entitiy ${mapper.entity.name}`, err);
          throw err;
        }
        if (!e || (Array.isArray(e) && !e.length)) {
          logger.error('Completely unexpected outcome', { mapper, e, context, });
        } else {
          try {
            await mapper.db.create(e, context);
          } catch (err: any) {
            logger.error(`Error reading from cloud entitiy ${mapper.entity.name}`, err);
            throw err;
          }
        }
      }));
    }
    return "Done!";
  } catch (e: any) {
    throw e;
  }
}

export async function uninstall(moduleList: string[], dbId: string, orm?: TypeormWrapper) {
  // Check to make sure that all specified modules actually exist
  const mods = moduleList.map((n: string) => (Object.values(Modules) as Modules.Module[]).find(m => `${m.name}@${m.version}` === n)) as Modules.Module[];
  if (mods.some((m: any) => m === undefined)) {
    throw new Error(`The following modules do not exist: ${
      moduleList.filter((n: string) => !(Object.values(Modules) as Modules.ModuleInterface[]).find(m => `${m.name}@${m.version}` === n)).join(', ')
    }`);
  }
  orm = !orm ? await TypeormWrapper.createConn(dbId) : orm;
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already uninstalled and prune them from the list
  const existingModules = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
  for (let i = 0; i < mods.length; i++) {
    if (!existingModules.includes(`${mods[i].name}@${mods[i].version}`)) {
      mods.splice(i, 1);
      i--;
    }
  }
  // See if we need to abort because now there's nothing to do
  if (mods.length === 0) {
    throw new Error("All modules already uninstalled.");
  }
  const remainingModules = existingModules.filter((m: string) => !mods.some(m2 => `${m2.name}@${m2.version}` === m));
  // Sort the modules based on their dependencies, with both root-to-leaf order and vice-versa
  const rootToLeafOrder = sortModules(mods, remainingModules);
  const leafToRootOrder = [...rootToLeafOrder].reverse();
  // Actually run the removal. Running all of the remove scripts from leaf-to-root. Wrapped in a
  // transaction so any failure at this point when we're actually mutating the database doesn't
  // leave things in a busted state.
  await queryRunner.startTransaction();
  try {
    for (const md of leafToRootOrder) {
      if (md.migrations?.remove) {
        await md.migrations.remove(queryRunner);
      }
    }
    for (const md of rootToLeafOrder) {
      const e = await orm.findOne(IasqlModule, { name: `${md.name}@${md.version}`, });
      const mt = await orm.find(IasqlTables, {
        where: {
          module: e,
        },
        relations: [ 'module', ]
      }) ?? [];
      await orm.remove(IasqlTables, mt);
      await orm.remove(IasqlModule, e);
    }
    await queryRunner.commitTransaction();
  } catch (e: any) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
  return "Done!";
}

export async function getStackInfo(dbId: string, stackName: string) {
  let orm: TypeormWrapper | null = null;
  try {
    orm = await TypeormWrapper.createConn(dbId);
    const accountModule = (Object.values(Modules) as Modules.ModuleInterface[])
      .find(mod => ['aws_account@0.0.1'].includes(`${mod.name}@${mod.version}`)) as Modules.Module;
    if (!accountModule) throw new Error(`This should be impossible. Cannot find module aws_account`);
    const moduleContext = accountModule.provides.context;
    const awsClient = await moduleContext?.getAwsClient(orm) as AWS;
    return await awsClient.getCloudFormationStack(stackName);
  } catch (e) {
    throw e;
  }
}
