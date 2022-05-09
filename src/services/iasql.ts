// TODO: It seems like a lot of this logic could be migrated into the iasql_platform module and make
// sense there. Need to think a bit more on that, but module manipulation that way could allow for
// meta operations within the module code itself, if desirable.
import { promisify, } from 'util'
import { exec as execNode, } from 'child_process'
const exec = promisify(execNode);

import { createConnection, } from 'typeorm'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'
import { snakeCase, } from 'typeorm/util/StringUtils'
import * as levenshtein from 'fastest-levenshtein'

import { DepError, lazyLoader, } from './lazy-dep'
import { findDiff, } from './diff'
import MetadataRepo from './repositories/metadata'
import { TypeormWrapper, } from './typeorm'
import * as AllModules from '../modules'
import { sortModules, } from './mod-sort'
import * as dbMan from './db-manager'
import { Context, MapperInterface, Module, ModuleInterface, } from '../modules'
import * as scheduler from './scheduler'
import { IasqlDatabase } from '../entity';
import logger, { debugObj } from './logger';

// Crupde = CR-UP-DE, Create/Update/Delete
type Crupde = { [key: string]: { id: string, description: string, }[], };
export function recordCount(records: { [key: string]: any, }[]): [number, number, number] {
  const dbCount = records.reduce((cumu, r) => cumu + r.diff.entitiesInDbOnly.length, 0);
  const cloudCount = records.reduce((cumu, r) => cumu + r.diff.entitiesInAwsOnly.length, 0);
  const bothCount = records.reduce((cumu, r) => cumu + r.diff.entitiesChanged.length, 0);
  return [dbCount, cloudCount, bothCount,];
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

export async function getDbRecCount(conn: TypeormWrapper): Promise<number> {
  // only looks at the public schema
  const res = await conn.query(`
    SELECT SUM(
      (xpath('/row/count/text()', query_to_xml('SELECT COUNT(*) FROM ' || format('%I.%I', table_schema, table_name), true, true, '')))[1]::text::int
    )
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);
  return parseInt(res[0].sum, 10);
}

export async function connect(
  dbAlias: string,
  uid: string,
  email: string,
  directConnect: boolean = false,
) {
  let conn1: any, conn2: any, dbId: any, dbUser: any;
  try {
    logger.info('Creating account for user...');
    const dbGen = dbMan.genUserAndPass();
    dbUser = dbGen[0];
    const dbPass = dbGen[1];
    dbId = dbMan.genDbId(dbAlias);
    const metaDb = new IasqlDatabase();
    metaDb.alias = dbAlias;
    metaDb.pgUser = dbUser;
    metaDb.pgName = dbId;
    metaDb.directConnect = directConnect
    await MetadataRepo.saveDb(uid, email, metaDb);
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
    await conn2.query(dbMan.newPostgresRoleQuery(dbUser, dbPass, dbId));
    await conn2.query(dbMan.grantPostgresRoleQuery(dbUser));
    await MetadataRepo.updateDbRecCount(dbId, await getDbRecCount(conn2));
    logger.info('Done!');
    return {
      alias: dbAlias,
      id: dbId,
      user: dbUser,
      password: dbPass,
    };
  } catch (e: any) {
    await scheduler.stop(dbId);
    // delete db in psql and metadata
    await conn1?.query(`DROP DATABASE IF EXISTS ${dbId} WITH (FORCE);`);
    if (dbUser) await conn1?.query(dbMan.dropPostgresRoleQuery(dbUser));
    await MetadataRepo.delDb(uid, dbAlias);
    // rethrow the error
    throw e;
  } finally {
    await conn1?.close();
    await conn2?.close();
  }
}

export async function attach(
  dbAlias: string,
  dbId: string,
  awsRegion: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  connOpt?: any
) {
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  let conn: any;
  let orm: TypeormWrapper | undefined;
  try {
    conn = !connOpt ? await createConnection({
      ...dbMan.baseConnConfig,
      name: dbId,
      database: dbId,
    }) : connOpt;
    await conn.query(`
      INSERT INTO aws_account (access_key_id, secret_access_key, region) VALUES ('${awsAccessKeyId}', '${awsSecretAccessKey}', '${awsRegion}')
    `);
    logger.info('Loading aws_account data...');
    // Manually load the relevant data from the cloud side for the `aws_account` module.
    // TODO: Figure out how to eliminate *most* of this special-casing for this module in the future
    const entities: Function[] = Object.values(Modules.AwsAccount.mappers).map((m: any) => m.entity);
    entities.push(Modules.IasqlPlatform.utils.IasqlModule);
    entities.push(Modules.IasqlPlatform.utils.IasqlTables);
    orm = await TypeormWrapper.createConn(dbId, { entities } as PostgresConnectionOptions);
    const mappers = Object.values(Modules.AwsAccount.mappers);
    const context: Context = { orm, memo: {}, ...Modules.AwsAccount.provides.context, };
    for (const mapper of mappers) {
      logger.info(`Loading aws_account table ${(mapper as any).entity.name}...`);
      const e = await (mapper as any).cloud.read(context);
      if (!e || (Array.isArray(e) && !e.length)) {
        logger.info(`${(mapper as any).entity.name} has no records in the cloud to store`);
      } else {
        // Since we manually inserted a half-broken record into `region` above, we need extra logic
        // here to make sure the newly-acquired records are properly inserted/updated in the DB. The
        // logic here is made generic for all mappers in `aws_account` in case we decide to do this
        // for other tables in the future above and not have it break unexpectedly.
        const existingRecords: any[] = await orm.find((mapper as any).entity);
        const existingIds = existingRecords.map((er: any) => (mapper as any).entityId(er));
        for (const entity of e) {
          if (existingRecords.length > 0) {
            const id = (mapper as any).entityId(entity);
            if (existingIds.includes(id)) {
              const ind = existingRecords.findIndex((_er, i) => existingIds[i] === id);
              entity.id = existingRecords[ind].id;
            }
          }
          await (mapper as any).db.create(entity, context);
        }
      }
    }
    return {
      alias: dbAlias,
    };
  } catch (e) {
    throw e;
  } finally {
    if (!connOpt) await conn?.close();
    await orm?.dropConn();
  }
}

export async function disconnect(dbAlias: string, uid: string) {
  let conn;
  try {
    const db: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
    await scheduler.stop(db.pgName);
    conn = await createConnection(dbMan.baseConnConfig);
    await conn.query(`
      DROP DATABASE IF EXISTS ${db.pgName} WITH (FORCE);
    `);
    await conn.query(dbMan.dropPostgresRoleQuery(db.pgUser));
    await MetadataRepo.delDb(uid, dbAlias);
    return db.pgName;
  } catch (e: any) {
    // re-throw
    throw e;
  } finally {
    conn?.close();
  }
}

export async function dump(dbId: string, dataOnly: boolean) {
  const pgUrl = dbMan.ourPgUrl(dbId);
  const excludedDataTables = '--exclude-table-data \'aws_account\' --exclude-table-data \'iasql_*\''
  const { stdout, } = await exec(
    `pg_dump ${dataOnly ?
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
    logger.info('Creating account for user...');
    const dbGen = dbMan.genUserAndPass();
    dbUser = dbGen[0];
    const dbPass = dbGen[1];
    const meta = await dbMan.setMetadata(dbAlias, dbUser, user);
    dbId = meta.dbId;
    logger.info('Establishing DB connections...');
    conn1 = await createConnection(dbMan.baseConnConfig);
    await conn1.query(`CREATE DATABASE ${dbId};`);
    conn2 = await createConnection({
      ...dbMan.baseConnConfig,
      name: dbId,
      database: dbId,
    });
    // Restore dump and wrap it in a try catch
    // that drops the database on error
    logger.info('Restoring schema and data from dump...');
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
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  let orm: TypeormWrapper | null = null;
  try {
    orm = !ormOpt ? await TypeormWrapper.createConn(dbId) : ormOpt;
    // Find all of the installed modules, and create the context object only for these
    const moduleNames = (await orm.find(Modules.IasqlPlatform.utils.IasqlModule)).map((m: any) => m.name);
    const memo: any = {}; // TODO: Stronger typing here
    const context: Context = { orm, memo, }; // Every module gets access to the DB
    for (const name of moduleNames) {
      const mod = (Object.values(Modules) as Module[]).find(m => `${m.name}@${m.version}` === name) as Module;
      if (!mod) throw new Error(`This should be impossible. Cannot find module ${name}`);
      const moduleContext = mod.provides.context ?? {};
      Object.keys(moduleContext).forEach(k => context[k] = moduleContext[k]);
    }
    // Get the relevant mappers, which are the ones where the DB is the source-of-truth
    const moduleList = (Object.values(Modules) as Module[])
      .filter(mod => moduleNames.includes(`${mod.name}@${mod.version}`));
    const rootToLeafOrder = sortModules(moduleList, []);
    const mappers = (rootToLeafOrder as ModuleInterface[])
      .map(mod => Object.values((mod as ModuleInterface).mappers))
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
          mapper: MapperInterface<any>,
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
        const [nextDbCount, nextCloudCount, nextBothCount,] = recordCount(records);
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
              logger.info(`${name} has records to update`, { records: r.diff.entitiesChanged, });
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
            return outArr;
          })
          .flat(9001);
        const reversePromiseGenerators = records
          .reverse()
          .map(r => {
            const name = r.table;
            logger.info(`Checking ${name}`);
            const outArr = [];
            if (r.diff.entitiesInAwsOnly.length > 0) {
              logger.info(`${name} has records to delete`);
              outArr.push(r.diff.entitiesInAwsOnly.map((e: any) => async () => {
                await r.mapper.cloud.delete(e, context);
              }));
            }
            return outArr;
          })
          .flat(9001);
        const generators = [...promiseGenerators, ...reversePromiseGenerators];
        if (generators.length > 0) {
          ranUpdate = true;
          ranFullUpdate = true;
          try {
            await lazyLoader(generators);
          } catch (e: any) {
            if (failureCount === e.metadata?.generatorsToRun?.length) throw e;
            failureCount = e.metadata?.generatorsToRun?.length;
            ranUpdate = false;
          }
          const t6 = Date.now();
          logger.info(`AWS update time: ${t6 - t5}ms`);
        }
      } while (ranUpdate);
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
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  let orm: TypeormWrapper | null = null;
  try {
    orm = !ormOpt ? await TypeormWrapper.createConn(dbId) : ormOpt;
    // Find all of the installed modules, and create the context object only for these
    const moduleNames = (await orm.find(Modules.IasqlPlatform.utils.IasqlModule)).map((m: any) => m.name);
    const memo: any = {}; // TODO: Stronger typing here
    const context: Context = { orm, memo, }; // Every module gets access to the DB
    for (const name of moduleNames) {
      const mod = (Object.values(Modules) as Module[]).find(m => `${m.name}@${m.version}` === name) as Module;
      if (!mod) throw new Error(`This should be impossible. Cannot find module ${name}`);
      const moduleContext = mod.provides.context ?? {};
      Object.keys(moduleContext).forEach(k => context[k] = moduleContext[k]);
    }
    // Get the mappers, regardless of source-of-truth
    const moduleList = (Object.values(Modules) as Module[])
      .filter(mod => moduleNames.includes(`${mod.name}@${mod.version}`));
    const rootToLeafOrder = sortModules(moduleList, []);
    const mappers = (rootToLeafOrder as ModuleInterface[])
      .map(mod => Object.values((mod as ModuleInterface).mappers))
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
          mapper: MapperInterface<any>,
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
        const [nextDbCount, nextCloudCount, nextBothCount,] = recordCount(records);
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
              logger.info(`${name} has records to update`, { records: r.diff.entitiesChanged, });
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
            return outArr;
          })
          .flat(9001);
        const reversePromiseGenerators = records
          .reverse()
          .map(r => {
            const name = r.table;
            logger.info(`Checking ${name}`);
            const outArr = [];
            if (r.diff.entitiesInDbOnly.length > 0) {
              logger.info(`${name} has records to delete`);
              outArr.push(r.diff.entitiesInDbOnly.map((e: any) => async () => {
                await r.mapper.db.delete(e, context);
              }));
            }
            return outArr;
          })
          .flat(9001);
        const generators = [...promiseGenerators, ...reversePromiseGenerators];
        if (generators.length > 0) {
          ranUpdate = true;
          ranFullUpdate = true;
          try {
            await lazyLoader(generators);
          } catch (e: any) {
            if (failureCount === e.metadata?.generatorsToRun?.length) throw e;
            failureCount = e.metadata?.generatorsToRun?.length;
            ranUpdate = false;
          }
          const t6 = Date.now();
          logger.info(`AWS update time: ${t6 - t5}ms`);
        }
      } while (ranUpdate);
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
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  const allModules = Object.values(Modules)
    .filter((m: any) => m.hasOwnProperty('mappers') && m.hasOwnProperty('name') && !/iasql_.*/.test(m.name))
    .map((m: any) => ({
      moduleName: m.name,
      moduleVersion: m.version,
      dependencies: m.dependencies.filter((d: any) => !/iasql_.*/.test(d)),
    }));
  if (all) {
    return JSON.stringify(allModules);
  } else if (installed && dbId) {
    const entities: Function[] = [
      Modules.IasqlPlatform.utils.IasqlModule,
      Modules.IasqlPlatform.utils.IasqlTables
    ];
    const orm = await TypeormWrapper.createConn(dbId, { entities } as PostgresConnectionOptions);
    const mods = await orm.find(Modules.IasqlPlatform.utils.IasqlModule);
    const modsInstalled = mods.map((m: any) => (m.name));
    return JSON.stringify(allModules.filter(m => modsInstalled.includes(`${m.moduleName}@${m.moduleVersion}`)));
  } else {
    throw new Error('Invalid request parameters');
  }
}

export async function install(moduleList: string[], dbId: string, dbUser: string, allModules = false, ormOpt?: TypeormWrapper) {
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  // Check to make sure that all specified modules actually exist
  if (allModules) {
    const installedModules = JSON.parse(await modules(false, true, dbId))
      .map((r: any) => r.moduleName);
    moduleList = (Object.values(Modules) as ModuleInterface[])
      .filter((m: ModuleInterface) => !installedModules.includes(m.name))
      .filter((m: ModuleInterface) => m.name && m.version && ![
        'iasql_platform',
        'iasql_functions',
      ].includes(m.name)).map((m: ModuleInterface) => `${m.name}@${m.version}`);
  }
  const version = Modules.IasqlPlatform.version;
  moduleList = moduleList.map((m: string) => /@/.test(m) ? m : `${m}@${version}`);
  const mods = moduleList.map((n: string) => (Object.values(Modules) as Module[]).find(m => `${m.name}@${m.version}` === n)) as Module[];
  if (mods.some((m: any) => m === undefined)) {
    const modNames = (Object.values(Modules) as ModuleInterface[])
      .filter(m => m.hasOwnProperty('name') && m.hasOwnProperty('version'))
      .map(m => `${m.name}@${m.version}`);
    const missingModules = moduleList
      .filter((n: string) => !(Object.values(Modules) as ModuleInterface[])
        .find(m => `${m.name}@${m.version}` === n));
    const missingSuggestions = [
      ...new Set(missingModules.map(m => levenshtein.closest(m, modNames))).values(),
    ];
    throw new Error(`The following modules do not exist: ${
      missingModules.join(', ')
    }. Did you mean: ${missingSuggestions.join(', ')}`);
  }
  const orm = !ormOpt ? await TypeormWrapper.createConn(dbId) : ormOpt;
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already installed and prune them from the list
  const existingModules = (await orm.find(Modules.IasqlPlatform.utils.IasqlModule)).map((m: any) => m.name);
  for (let i = 0; i < mods.length; i++) {
    if (existingModules.includes(mods[i].name)) {
      mods.splice(i, 1);
      i--;
    }
  }
  // Check to make sure that all dependent modules are in the list
  const missingDeps = mods
    .flatMap((m: Module) => m.dependencies.filter(d => !moduleList.includes(d) && !existingModules.includes(d)))
    .filter((m: any) => ![
      `iasql_platform@${version}`,
      `iasql_functions@${version}`,
    ].includes(m) && m !== undefined);
  if (missingDeps.length > 0) {
    logger.warn('Automatically attaching missing dependencies to this install', { moduleList, missingDeps, });
    const extraMods = missingDeps.map((n: string) => (Object.values(Modules) as Module[]).find(m => `${m.name}@${m.version}` === n)) as Module[];
    mods.push(...extraMods);
  }
  // See if we need to abort because now there's nothing to do
  if (mods.length === 0) {
    logger.warn('All modules already installed', { moduleList, });
    return "Done!";
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
      const e = new Modules.IasqlPlatform.utils.IasqlModule();
      e.name = `${md.name}@${md.version}`;
      // Promise.all is okay here because it's guaranteed to not hit the cloud services
      e.dependencies = await Promise.all(
        md.dependencies.map(async (dep) => await orm.findOne(Modules.IasqlPlatform.utils.IasqlModule, { name: dep, }))
      );
      await orm.save(Modules.IasqlPlatform.utils.IasqlModule, e);

      const modTables = md.provides.tables?.map((t) => {
        const mt = new Modules.IasqlPlatform.utils.IasqlTables();
        mt.table = t;
        mt.module = e;
        return mt;
      }) ?? [];
      await orm.save(Modules.IasqlPlatform.utils.IasqlTables, modTables);
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
  const moduleNames = (await orm.find(Modules.IasqlPlatform.utils.IasqlModule)).map((m: any) => m.name);
  const context: Context = { orm, memo: {}, }; // Every module gets access to the DB
  for (const name of moduleNames) {
    const md = (Object.values(Modules) as Module[]).find(m => `${m.name}@${m.version}` === name) as Module;
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
          logger.error(`Error reading from cloud entity ${mapper.entity.name}`, err);
          throw err;
        }
        if (!e || (Array.isArray(e) && !e.length)) {
          logger.warn('No cloud entity records');
        } else {
          try {
            await mapper.db.create(e, context);
          } catch (err: any) {
            logger.error(`Error reading from cloud entity ${mapper.entity.name}`, { e, err, });
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
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  // Check to make sure that all specified modules actually exist
  const version = Modules.IasqlPlatform.version
  moduleList = moduleList.map((m: string) => /@/.test(m) ? m : `${m}@${version}`);
  const mods = moduleList.map((n: string) => (Object.values(Modules) as Module[]).find(m => `${m.name}@${m.version}` === n)) as Module[];
  if (mods.some((m: any) => m === undefined)) {
    throw new Error(`The following modules do not exist: ${moduleList.filter((n: string) => !(Object.values(Modules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n)).join(', ')
      }`);
  }
  orm = !orm ? await TypeormWrapper.createConn(dbId) : orm;
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already uninstalled and prune them from the list
  const existingModules = (await orm.find(Modules.IasqlPlatform.utils.IasqlModule)).map((m: any) => m.name);
  for (let i = 0; i < mods.length; i++) {
    if (!existingModules.includes(`${mods[i].name}@${mods[i].version}`)) {
      mods.splice(i, 1);
      i--;
    }
  }
  // See if we need to abort because now there's nothing to do
  if (mods.length === 0) {
    logger.warn('All modules already uninstalled', { moduleList, });
    return "Done!";
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
      const e = await orm.findOne(Modules.IasqlPlatform.utils.IasqlModule, { name: `${md.name}@${md.version}`, });
      const mt = await orm.find(Modules.IasqlPlatform.utils.IasqlTables, {
        where: {
          module: e,
        },
        relations: ['module',]
      }) ?? [];
      await orm.remove(Modules.IasqlPlatform.utils.IasqlTables, mt);
      await orm.remove(Modules.IasqlPlatform.utils.IasqlModule, e);
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

// This function is always going to have special-cased logic for it, but hopefully it ends up in a
// few different 'groups' by version number instead of being special-cased for each version.
export async function upgrade(dbId: string, dbUser: string) {
  const versionString = await TypeormWrapper.getVersionString(dbId);
  switch (versionString) {
    case 'v0_0_1':
      // The upgrade path here is manual and can't assume much because we broke the versioning
      // contract with v0.0.1. It also has to happen async to the response because Postgres itself
      // locks up if you drop the tables out from under it, apparently?
      (async () => {
        let conn: any;
        try {
          conn = await createConnection({
            ...dbMan.baseConnConfig,
            name: dbId,
            database: dbId,
          });
          // 1. Read the `iasql_module` table to get all currently installed modules.
          const mods = (await conn.query(`
            SELECT name FROM iasql_module;
          `)).map((r: any) => r.name.split('@')[0]);
          const tables = (await conn.query(`
            SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';
          `)).map((r: any) => r.tablename);
          const enums = (await conn.query(`
            SELECT t.typname
            FROM pg_catalog.pg_type AS t
            INNER JOIN pg_catalog.pg_namespace AS n ON t.typnamespace = n.oid
            WHERE n.nspname = 'public' AND t.typtype = 'e';
          `)).map((r: any) => r.typname);
          let creds: any;
          // 2. Read the `aws_account` table to get the credentials (if any).
          if (mods.includes('aws_account')) {
            creds = (await conn.query(`
              SELECT access_key_id, secret_access_key, region FROM aws_account LIMIT 1;
            `))[0];
          }
          // 3. Manually drop all tables and function from the DB
          await conn.query(`
            -- This first drop should take care of most of the functions
            DROP FUNCTION IF EXISTS until_iasql_operation CASCADE;
            -- And the few that don't depend directly or indirectly on it
            DROP FUNCTION IF EXISTS delete_all_records CASCADE;
            DROP FUNCTION IF EXISTS iasql_help CASCADE;
          `);
          for (const table of tables) {
            await conn.query(`
              DROP TABLE IF EXISTS ${table} CASCADE;
            `);
          }
          for (const enu of enums) {
            await conn.query(`
              DROP TYPE IF EXISTS ${enu} CASCADE;
            `);
          }
          // 4. Re-run a the `/connect` logic to get the latest structure in the DB.
          await dbMan.migrate(conn);
          // 5. If `aws_account` and other modules are installed, install `aws_account`, insert the
          //    credentials, then install the rest of the modules.
          if (!!creds) {
            await install(['aws_account'], dbId, dbUser);
            await conn.query(`
              INSERT INTO aws_account (access_key_id, secret_access_key, region)
              VALUES ('${creds.access_key_id}', '${creds.secret_access_key}', '${creds.region}');
            `);
            await install(mods.filter((m: string) => ![
              'aws_account', 'iasql_platform', 'iasql_functions'
            ].includes(m)), dbId, dbUser);
          }
        } catch (e) {
          logger.error('Failed to upgrade', { e, });
        } finally {
          conn?.close();
        }
      })();
      throw new Error('Upgrading. Please disconnect and reconnect to the database');
    case 'v0_0_2':
      // The upgrade path here *should* work for all versions going forward. 0.0.1 was the exception
      // since we broke the migration contract with it. If/when there's a change to this statement
      // this code will need to be updated with another branch
      (async () => {
        // The first half of the logic is the same as the v0.0.1 upgrade logic: Figure out all of
        // the modules installed, and if the `aws_account` module is installed, also grab those
        // credentials (eventually need to make this distinction and need generalized). But now we
        // then run the `uninstall` code for the old version of the modules, then install with the
        // new versions, with a special 'breakpoint' with `aws_account` if it exists to insert the
        // credentials so the other modules install correctly. (This should also be automated in
        // some way later.)
        let conn: any;
        try {
          conn = await createConnection({
            ...dbMan.baseConnConfig,
            name: dbId,
            database: dbId,
          });
          // 1. Read the `iasql_module` table to get all currently installed modules.
          const mods: string[] = (await conn.query(`
            SELECT name FROM iasql_module;
          `)).map((r: any) => r.name.split('@')[0]);
          // 2. Read the `aws_account` table to get the credentials (if any).
          let creds: any;
          if (mods.includes('aws_account')) {
            creds = (await conn.query(`
              SELECT access_key_id, secret_access_key, region FROM aws_account LIMIT 1;
            `))[0];
          }
          // 3. Uninstall all of the non-`iasql_*` modules
          const nonIasqlMods = mods.filter(m => !/^iasql/.test(m));
          await uninstall(nonIasqlMods, dbId);
          // 4. Uninstall the `iasql_*` modules manually
          const OldModules = AllModules.v0_0_2;
          const qr = conn.createQueryRunner();
          await OldModules.IasqlFunctions.migrations.remove(qr);
          await OldModules.IasqlPlatform.migrations.remove(qr);
          // 5. Install the new `iasql_*` modules manually
          const NewModules = AllModules.v0_0_3;
          await NewModules.IasqlPlatform.migrations.install(qr);
          await NewModules.IasqlFunctions.migrations.install(qr);
          await conn.query(`
            INSERT INTO iasql_module (name) VALUES ('iasql_platform@0.0.3'), ('iasql_functions@0.0.3');
            INSERT INTO iasql_dependencies (module, dependency) VALUES ('iasql_functions@0.0.3', 'iasql_platform@0.0.3');
          `);
          // 6. Install the `aws_account` module and then re-insert the creds if present, then add
          //    the rest of the modules back.
          if (!!creds) {
            await install(['aws_account'], dbId, dbUser);
            await conn.query(`
              INSERT INTO aws_account (access_key_id, secret_access_key, region)
              VALUES ('${creds.access_key_id}', '${creds.secret_access_key}', '${creds.region}');
            `);
            await install(mods.filter((m: string) => ![
              'aws_account', 'iasql_platform', 'iasql_functions'
            ].includes(m)), dbId, dbUser);
          }
        } catch (e) {
          logger.error('Failed to upgrade', { e, });
        } finally {
          conn?.close();
        }
      })();
      throw new Error('Upgrading. Please disconnect and reconnect to the database');
    case 'v0_0_3':
    case 'latest':
      throw new Error('Up to date');
    default:
      throw new Error(
        'Unknown version. No upgrade possible, please drop this database and create a new one.'
      );
  }
}
