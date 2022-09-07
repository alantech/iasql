// TODO: It seems like a lot of this logic could be migrated into the iasql_platform module and make
// sense there. Need to think a bit more on that, but module manipulation that way could allow for
// meta operations within the module code itself, if desirable.
import { exec as execNode } from 'child_process';
import * as levenshtein from 'fastest-levenshtein';
import pg from 'pg';
import { parse, deparse } from 'pgsql-parser';
import { createConnection } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { snakeCase } from 'typeorm/util/StringUtils';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

import config from '../config';
import { throwError } from '../config/config';
import { IasqlDatabase } from '../entity';
import { modules as AllModules } from '../modules';
import { Context, MapperInterface, ModuleInterface } from '../modules';
import { isString } from './common';
import * as dbMan from './db-manager';
import { findDiff } from './diff';
import { DepError, lazyLoader } from './lazy-dep';
import logger, { debugObj } from './logger';
import { sortModules } from './mod-sort';
import MetadataRepo from './repositories/metadata';
import * as scheduler from './scheduler-api';
import { TypeormWrapper } from './typeorm';

const exec = promisify(execNode);

// Crupde = CR-UP-DE, Create/Update/Delete
type Crupde = { [key: string]: { id: string; description: string }[] };
export function recordCount(records: { [key: string]: any }[]): [number, number, number] {
  const dbCount = records.reduce((cumu, r) => cumu + r.diff.entitiesInDbOnly.length, 0);
  const cloudCount = records.reduce((cumu, r) => cumu + r.diff.entitiesInAwsOnly.length, 0);
  const bothCount = records.reduce((cumu, r) => cumu + r.diff.entitiesChanged.length, 0);
  return [dbCount, cloudCount, bothCount];
}
const iasqlPlanV3 = (toCreate: Crupde, toUpdate: Crupde, toReplace: Crupde, toDelete: Crupde) =>
  JSON.stringify({
    iasqlPlanVersion: 3,
    rows: (() => {
      const out: any[] = [];
      Object.keys(toCreate).forEach(tbl => {
        const recs = toCreate[tbl];
        recs.forEach(rec => out.push({ action: 'create', tableName: snakeCase(tbl), ...rec }));
      });
      Object.keys(toUpdate).forEach(tbl => {
        const recs = toUpdate[tbl];
        recs.forEach(rec => out.push({ action: 'update', tableName: snakeCase(tbl), ...rec }));
      });
      Object.keys(toReplace).forEach(tbl => {
        const recs = toReplace[tbl];
        recs.forEach(rec => out.push({ action: 'replace', tableName: snakeCase(tbl), ...rec }));
      });
      Object.keys(toDelete).forEach(tbl => {
        const recs = toDelete[tbl];
        recs.forEach(rec => out.push({ action: 'delete', tableName: snakeCase(tbl), ...rec }));
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
    WHERE table_schema = 'public' AND table_name NOT LIKE 'iasql_%'
  `);
  return parseInt(res[0].sum ?? '0', 10);
}

export async function getOpCount(conn: TypeormWrapper): Promise<number> {
  const res = await conn.query(`
    SELECT COUNT(*)
    FROM iasql_operation
  `);
  return parseInt(res[0].count ?? '0', 10);
}

export async function connect(dbAlias: string, uid: string, email: string, dbId = dbMan.genDbId(dbAlias)) {
  let conn1: any, conn2: any, dbUser: any;
  let dbSaved,
    schedulerStarted,
    roleGranted = false;
  try {
    logger.info('Creating account for user...');
    const dbGen = dbMan.genUserAndPass();
    dbUser = dbGen[0];
    const dbPass = dbGen[1];
    const metaDb = new IasqlDatabase();
    metaDb.alias = dbAlias;
    metaDb.pgUser = dbUser;
    metaDb.pgName = dbId;
    await MetadataRepo.saveDb(uid, email, metaDb);
    dbSaved = true;
    logger.info('Establishing DB connections...');
    conn1 = await createConnection(dbMan.baseConnConfig);
    await conn1.query(`
      CREATE DATABASE ${dbId};
    `);
    // wait for the scheduler to start and register its migrations before ours so that the stored procedures
    // that use the scheduler's schema succeed
    await scheduler.start(dbId, dbUser);
    schedulerStarted = true;
    conn2 = await createConnection({
      ...dbMan.baseConnConfig,
      name: dbId,
      database: dbId,
    });
    await dbMan.migrate(conn2);
    await conn2.query(dbMan.newPostgresRoleQuery(dbUser, dbPass, dbId));
    await conn2.query(dbMan.grantPostgresRoleQuery(dbUser));
    roleGranted = true;
    const recCount = await getDbRecCount(conn2);
    const opCount = await getOpCount(conn2);
    await MetadataRepo.updateDbCounts(dbId, recCount, opCount);
    logger.info('Done!');
    // Return custom IasqlDatabase object since we need to return the password
    return {
      user: dbUser,
      password: dbPass,
      recordCount: recCount,
      operationCount: opCount,
      alias: dbAlias,
      id: dbId,
    };
  } catch (e: any) {
    if (schedulerStarted) await scheduler.stop(dbId);
    // delete db in psql and metadata
    if (dbSaved) await conn1?.query(`DROP DATABASE IF EXISTS ${dbId} WITH (FORCE);`);
    if (dbUser && roleGranted) await conn1?.query(dbMan.dropPostgresRoleQuery(dbUser));
    if (dbSaved) await MetadataRepo.delDb(uid, dbAlias);
    // rethrow the error
    throw e;
  } finally {
    await conn1?.close();
    await conn2?.close();
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

export async function runSql(dbAlias: string, uid: string, sql: string, byStatement: boolean) {
  let connMain: any, connTemp: any;
  const user = `_${uuidv4().replace(/-/g, '')}`;
  const pass = `_${uuidv4().replace(/-/g, '')}`;
  const db: IasqlDatabase = await MetadataRepo.getDb(uid, dbAlias);
  if (db?.upgrading) throw new Error('Currently upgrading, cannot query at this time');
  const database = db.pgName;
  try {
    connMain = await createConnection({ ...dbMan.baseConnConfig, database, name: pass });
    // Apparently GRANT and REVOKE can run into concurrency issues in Postgres. Serializing it would
    // be best, but https://www.postgresql.org/message-id/3473.1393693757%40sss.pgh.pa.us says that
    // just retrying ought to work. Doing this in a simple do-while loop with a counter to abort if
    // too many attempts occur.
    let maxTries = 10;
    let success = true;
    do {
      try {
        await connMain.query(dbMan.newPostgresRoleQuery(user, pass, database));
        success = true;
      } catch (_) {
        success = false;
      }
      maxTries--;
    } while (!success && maxTries);
    maxTries = 10;
    success = true;
    do {
      try {
        await connMain.query(dbMan.grantPostgresRoleQuery(user));
        success = true;
      } catch (_) {
        success = false;
      }
      maxTries--;
    } while (!success && maxTries);
    connTemp = new pg.Client({
      database,
      user,
      password: pass,
      host: dbMan.baseConnConfig.host,
      ssl: dbMan.baseConnConfig.extra.ssl,
    });
    await connTemp.connect();
    const stmts = parse(sql);
    const out = [];
    for (const stmt of stmts) {
      if (byStatement) {
        out.push({
          statement: deparse(stmt),
          queryRes: await connTemp.query(deparse(stmt)),
        });
      } else {
        out.push(await connTemp.query(deparse(stmt)));
      }
    }
    // Let's make this a bit easier to parse. Error -> error path, single table -> array of objects,
    // multiple tables -> array of array of objects
    return out.map(t => {
      if (byStatement) {
        if (
          !!t.queryRes.rows &&
          t.queryRes.rows.length === 0 &&
          t.queryRes.command !== 'SELECT' &&
          typeof t.queryRes.rowCount === 'number'
        ) {
          return { statement: t.statement, affected_records: t.queryRes.rowCount };
        } else if (isString(t.queryRes)) {
          return { statement: t.statement, result: t.queryRes };
        } else if (!!t.queryRes.rows) {
          return { statement: t.statement, result: t.queryRes.rows };
        } else {
          return { statement: t.statement, error: `unexpected result: ${t.queryRes}` }; // TODO: Error this out
        }
      } else {
        if (!!t.rows && t.rows.length === 0 && t.command !== 'SELECT' && typeof t.rowCount === 'number') {
          return { affected_records: t.rowCount };
        } else if (isString(t)) {
          return { result: t };
        } else if (!!t.rows) {
          return t.rows;
        } else {
          return { error: `unexpected result: ${t}` }; // TODO: Error this out
        }
      }
    });
  } catch (e: any) {
    // re-throw
    throw e;
  } finally {
    // Put this in a timeout so it doesn't block returning to the user
    setTimeout(async () => {
      await connTemp?.end();
      // Same idea as above, but for the credential revocation
      let maxTries = 10;
      let success = true;
      do {
        try {
          await connMain?.query(dbMan.revokePostgresRoleQuery(user, database));
          success = true;
        } catch (_) {
          success = false;
        }
        maxTries--;
      } while (!success && maxTries);
      maxTries = 10;
      success = true;
      do {
        try {
          await connMain?.query(dbMan.dropPostgresRoleQuery(user));
        } catch (_) {
          success = false;
        }
        maxTries--;
      } while (!success && maxTries);
      await connMain?.close();
    }, 1);
  }
}

export async function dump(dbId: string, dataOnly: boolean) {
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (dbMeta?.upgrading) throw new Error('Currently upgrading, cannot dump this database');
  const pgUrl = dbMan.ourPgUrl(dbId);
  // TODO: Drop the old 'aws_account' when v0.0.19 is the oldest version.
  // Also TODO: Automatically figure out which tables to exclude here.
  const excludedDataTables =
    "--exclude-table-data 'aws_account' --exclude-table-data 'aws_credentials' --exclude-table-data 'iasql_*'";
  const { stdout } = await exec(
    `pg_dump ${
      dataOnly
        ? `--data-only --no-privileges --column-inserts --rows-per-insert=50 --on-conflict-do-nothing ${excludedDataTables}`
        : ''
    } --inserts --exclude-schema=graphile_worker -x ${pgUrl}`,
    { shell: '/bin/bash' },
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

function colToRow(cols: { [key: string]: any[] }): { [key: string]: any }[] {
  // Assumes equal length for all arrays
  const keys = Object.keys(cols);
  const out: { [key: string]: any }[] = [];
  for (let i = 0; i < cols[keys[0]].length; i++) {
    const row: { [key: string]: any } = {};
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
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (dbMeta?.upgrading) throw new Error('Cannot apply a change while upgrading');
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  if (!Modules)
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  let orm: TypeormWrapper | null = null;
  try {
    orm = !ormOpt ? await TypeormWrapper.createConn(dbId) : ormOpt;
    // Find all of the installed modules, and create the context object only for these
    const iasqlModule =
      Modules?.IasqlPlatform?.utils?.IasqlModule ??
      Modules?.iasqlPlatform?.iasqlModule ??
      throwError('Core IasqlModule not found');
    const moduleNames = (await orm.find(iasqlModule)).map((m: any) => m.name);
    const memo: any = {}; // TODO: Stronger typing here
    const context: Context = { orm, memo }; // Every module gets access to the DB
    for (const name of moduleNames) {
      const mod = (Object.values(Modules) as ModuleInterface[]).find(
        m => `${m.name}@${m.version}` === name,
      ) as ModuleInterface;
      if (!mod) throw new Error(`This should be impossible. Cannot find module ${name}`);
      const moduleContext = mod?.provides?.context ?? {};
      Object.keys(moduleContext).forEach(k => (context[k] = moduleContext[k]));
    }
    // Get the relevant mappers, which are the ones where the DB is the source-of-truth
    const moduleList = (Object.values(Modules) as ModuleInterface[]).filter(mod =>
      moduleNames.includes(`${mod.name}@${mod.version}`),
    );
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
      logger.info('Starting outer loop');
      ranFullUpdate = false;
      const tables = mappers.map(mapper => mapper.entity.name);
      memo.db = {}; // Flush the DB entities on the outer loop to restore the actual intended state
      await lazyLoader(
        mappers.map(mapper => async () => {
          await mapper.db.read(context);
        }),
      );
      const comparators = mappers.map(mapper => mapper.equals);
      const idGens = mappers.map(mapper => mapper.entityId);
      let ranUpdate = false;
      do {
        logger.info('Starting inner loop');
        ranUpdate = false;
        memo.cloud = {}; // Flush the Cloud entities on the inner loop to track changes to the state
        await lazyLoader(
          mappers.map(mapper => async () => {
            await mapper.cloud.read(context);
          }),
        );
        const t3 = Date.now();
        logger.info(`Record acquisition time: ${t3 - t2}ms`);
        const records = colToRow({
          table: tables,
          mapper: mappers,
          dbEntity: tables.map(t => (memo.db[t] ? Object.values(memo.db[t]) : [])),
          cloudEntity: tables.map(t => (memo.cloud[t] ? Object.values(memo.cloud[t]) : [])),
          comparator: comparators,
          idGen: idGens,
        });
        const t4 = Date.now();
        logger.info(`AWS Mapping time: ${t4 - t3}ms`);
        if (!records.length) {
          // Only possible on just-created databases
          return JSON.stringify({
            iasqlPlanVersion: 3,
            rows: [],
          });
        }
        const updatePlan = (crupde: Crupde, entityName: string, mapper: MapperInterface<any>, es: any[]) => {
          crupde[entityName] = crupde[entityName] ?? [];
          const rs = es.map((e: any) => ({
            id: e?.id?.toString() ?? '',
            description: mapper.entityId(e),
          }));
          rs.forEach(r => {
            if (
              !crupde[entityName].some(
                r2 => Object.is(r2.id, r.id) && Object.is(r2.description, r.description),
              )
            )
              crupde[entityName].push(r);
          });
        };
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
        const [nextDbCount, nextCloudCount, nextBothCount] = recordCount(records);
        if (dbCount === nextDbCount && cloudCount === nextCloudCount && bothCount === nextBothCount) {
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
              logger.info(`${name} has records to create`, { records: r.diff.entitiesInDbOnly });
              outArr.push(
                r.diff.entitiesInDbOnly.map((e: any) => async () => {
                  const out = await r.mapper.cloud.create(e, context);
                  if (out) {
                    const es = Array.isArray(out) ? out : [out];
                    es.forEach(e2 => {
                      // Mutate the original entity with the returned entity's properties so the actual
                      // record created is what is compared the next loop through
                      Object.keys(e2).forEach(k => (e[k] = e2[k]));
                    });
                  }
                }),
              );
            }
            if (r.diff.entitiesChanged.length > 0) {
              logger.info(`${name} has records to update`, { records: r.diff.entitiesChanged });
              outArr.push(
                r.diff.entitiesChanged.map((ec: any) => async () => {
                  const out = await r.mapper.cloud.update(ec.db, context); // Assuming SoT is the DB
                  if (out) {
                    const es = Array.isArray(out) ? out : [out];
                    es.forEach(e2 => {
                      // Mutate the original entity with the returned entity's properties so the actual
                      // record created is what is compared the next loop through
                      Object.keys(e2).forEach(k => (ec.db[k] = e2[k]));
                    });
                  }
                }),
              );
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
              logger.info(`${name} has records to delete`, { records: r.diff.entitiesInAwsOnly });
              outArr.push(
                r.diff.entitiesInAwsOnly.map((e: any) => async () => {
                  await r.mapper.cloud.delete(e, context);
                }),
              );
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

export async function sync(dbId: string, dryRun: boolean, force = false, ormOpt?: TypeormWrapper) {
  const t1 = Date.now();
  logger.info(`Syncing ${dbId}`);
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (!force && dbMeta?.upgrading) throw new Error('Cannot sync with the cloud while upgrading');
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  if (!Modules)
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  let orm: TypeormWrapper | null = null;
  try {
    orm = !ormOpt ? await TypeormWrapper.createConn(dbId) : ormOpt;
    // Find all of the installed modules, and create the context object only for these
    const iasqlModule =
      Modules?.IasqlPlatform?.utils?.IasqlModule ??
      Modules?.iasqlPlatform?.iasqlModule ??
      throwError('Core IasqlModule not found');
    const moduleNames = (await orm.find(iasqlModule)).map((m: any) => m.name);
    const memo: any = {}; // TODO: Stronger typing here
    const context: Context = { orm, memo }; // Every module gets access to the DB
    for (const name of moduleNames) {
      const mod = (Object.values(Modules) as ModuleInterface[]).find(
        m => `${m.name}@${m.version}` === name,
      ) as ModuleInterface;
      if (!mod) throw new Error(`This should be impossible. Cannot find module ${name}`);
      const moduleContext = mod?.provides?.context ?? {};
      Object.keys(moduleContext).forEach(k => (context[k] = moduleContext[k]));
    }
    // Get the mappers, regardless of source-of-truth
    const moduleList = (Object.values(Modules) as ModuleInterface[]).filter(mod =>
      moduleNames.includes(`${mod.name}@${mod.version}`),
    );
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
      await lazyLoader(
        mappers.map(mapper => async () => {
          await mapper.cloud.read(context);
        }),
      );
      const comparators = mappers.map(mapper => mapper.equals);
      const idGens = mappers.map(mapper => mapper.entityId);
      let ranUpdate = false;
      do {
        ranUpdate = false;
        memo.db = {}; // Flush the DB entities on the inner loop to track changes to the state
        await lazyLoader(
          mappers.map(mapper => async () => {
            await mapper.db.read(context);
          }),
        );
        const t3 = Date.now();
        logger.info(`Record acquisition time: ${t3 - t2}ms`);
        const records = colToRow({
          table: tables,
          mapper: mappers,
          dbEntity: tables.map(t => (memo.db[t] ? Object.values(memo.db[t]) : [])),
          cloudEntity: tables.map(t => (memo.cloud[t] ? Object.values(memo.cloud[t]) : [])),
          comparator: comparators,
          idGen: idGens,
        });
        const t4 = Date.now();
        logger.info(`AWS Mapping time: ${t4 - t3}ms`);
        if (!records.length) {
          // Only possible on just-created databases
          return JSON.stringify({
            iasqlPlanVersion: 3,
            rows: [],
          });
        }
        const updatePlan = (crupde: Crupde, entityName: string, mapper: MapperInterface<any>, es: any[]) => {
          crupde[entityName] = crupde[entityName] ?? [];
          const rs = es.map((e: any) => ({
            id: e?.id?.toString() ?? '',
            description: mapper.entityId(e),
          }));
          rs.forEach(r => {
            if (
              !crupde[entityName].some(
                r2 => Object.is(r2.id, r.id) && Object.is(r2.description, r.description),
              )
            )
              crupde[entityName].push(r);
          });
        };
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
        const [nextDbCount, nextCloudCount, nextBothCount] = recordCount(records);
        if (dbCount === nextDbCount && cloudCount === nextCloudCount && bothCount === nextBothCount) {
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
              logger.info(`${name} has records to create`, { records: r.diff.entitiesInAwsOnly });
              outArr.push(
                r.diff.entitiesInAwsOnly.map((e: any) => async () => {
                  const out = await r.mapper.db.create(e, context);
                  if (out) {
                    const es = Array.isArray(out) ? out : [out];
                    es.forEach(e2 => {
                      // Mutate the original entity with the returned entity's properties so the actual
                      // record created is what is compared the next loop through
                      Object.keys(e2).forEach(k => (e[k] = e2[k]));
                    });
                  }
                }),
              );
            }
            if (r.diff.entitiesChanged.length > 0) {
              logger.info(`${name} has records to update`, { records: r.diff.entitiesChanged });
              outArr.push(
                r.diff.entitiesChanged.map((ec: any) => async () => {
                  if (ec.db.id) ec.cloud.id = ec.db.id;
                  const out = await r.mapper.db.update(ec.cloud, context); // When `sync`ing we assume SoT is the Cloud
                  if (out) {
                    const es = Array.isArray(out) ? out : [out];
                    es.forEach(e2 => {
                      // Mutate the original entity with the returned entity's properties so the actual
                      // record created is what is compared the next loop through
                      Object.keys(e2).forEach(k => (ec.cloud[k] = e2[k]));
                    });
                  }
                }),
              );
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
              logger.info(`${name} has records to delete`, { records: r.diff.entitiesInDbOnly });
              outArr.push(
                r.diff.entitiesInDbOnly.map((e: any) => async () => {
                  await r.mapper.db.delete(e, context);
                }),
              );
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
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (dbMeta?.upgrading) throw new Error('Cannot check modules while upgrading');
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  if (!Modules)
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  const allModules = Object.values(Modules)
    .filter((m: any) => m.hasOwnProperty('mappers') && m.hasOwnProperty('name') && !/iasql_.*/.test(m.name))
    .filter((m: any) => process.env.IASQL_ENV !== 'production' || !/aws_ecs_simplified.*/.test(m.name)) // Temporarily disable ecs_simplified in production
    .map((m: any) => ({
      moduleName: m.name,
      moduleVersion: m.version,
      dependencies: m.dependencies.filter((d: any) => !/iasql_.*/.test(d)),
    }));
  if (all) {
    return JSON.stringify(allModules);
  } else if (installed && dbId) {
    const iasqlModule =
      Modules?.IasqlPlatform?.utils?.IasqlModule ??
      Modules?.iasqlPlatform?.iasqlModule ??
      throwError('Core IasqlModule not found');
    const iasqlTables =
      Modules?.IasqlPlatform?.utils?.IasqlTables ??
      Modules?.iasqlPlatform?.iasqlTables ??
      throwError('Core IasqlTables not found');
    const entities: Function[] = [iasqlModule, iasqlTables];
    const orm = await TypeormWrapper.createConn(dbId, { entities } as PostgresConnectionOptions);
    const mods = await orm.find(iasqlModule);
    const modsInstalled = mods.map((m: any) => m.name);
    return JSON.stringify(
      allModules.filter(m => modsInstalled.includes(`${m.moduleName}@${m.moduleVersion}`)),
    );
  } else {
    throw new Error('Invalid request parameters');
  }
}

export async function install(
  moduleList: string[],
  dbId: string,
  dbUser: string,
  allModules = false,
  force = false,
  ormOpt?: TypeormWrapper,
) {
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (!force && dbMeta?.upgrading) throw new Error('Cannot install modules while upgrading');
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  if (!Modules)
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  // Check to make sure that all specified modules actually exist
  if (allModules) {
    const installedModules = JSON.parse(await modules(false, true, dbId)).map((r: any) => r.moduleName);
    moduleList = (Object.values(Modules) as ModuleInterface[])
      .filter((m: ModuleInterface) => !installedModules.includes(m.name))
      .filter(
        (m: ModuleInterface) =>
          m.name && m.version && !['iasql_platform', 'iasql_functions'].includes(m.name),
      )
      .map((m: ModuleInterface) => `${m.name}@${m.version}`);
  }
  const version =
    Modules?.IasqlPlatform?.version ??
    Modules?.iasqlPlatform?.version ??
    throwError('IasqlPlatform not found');
  moduleList = moduleList.map((m: string) => (/@/.test(m) ? m : `${m}@${version}`));
  const mods = moduleList.map((n: string) =>
    (Object.values(Modules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
  ) as ModuleInterface[];
  if (mods.some((m: any) => m === undefined)) {
    const modNames = (Object.values(Modules) as ModuleInterface[])
      .filter(m => m.hasOwnProperty('name') && m.hasOwnProperty('version'))
      .map(m => `${m.name}@${m.version}`);
    const missingModules = moduleList.filter(
      (n: string) => !(Object.values(Modules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
    );
    const missingSuggestions = [
      ...new Set(missingModules.map(m => levenshtein.closest(m, modNames))).values(),
    ];
    throw new Error(
      `The following modules do not exist: ${missingModules.join(
        ', ',
      )}. Did you mean: ${missingSuggestions.join(', ')}`,
    );
  }
  const orm = !ormOpt ? await TypeormWrapper.createConn(dbId) : ormOpt;
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already installed and prune them from the list
  const iasqlModule =
    Modules?.IasqlPlatform?.utils?.IasqlModule ??
    Modules?.iasqlPlatform?.iasqlModule ??
    throwError('Core IasqlModule not found');
  const existingModules = (await orm.find(iasqlModule)).map((m: any) => m.name);
  for (let i = 0; i < mods.length; i++) {
    if (existingModules.includes(`${mods[i].name}@${mods[i].version}`)) {
      mods.splice(i, 1);
      i--;
    }
  }
  // Check to make sure that all dependent modules are in the list
  let missingDeps: string[] = [];
  do {
    missingDeps = [
      ...new Set(
        mods
          .flatMap((m: ModuleInterface) =>
            m.dependencies.filter(d => !moduleList.includes(d) && !existingModules.includes(d)),
          )
          .filter(
            (m: any) =>
              ![`iasql_platform@${version}`, `iasql_functions@${version}`].includes(m) && m !== undefined,
          ),
      ),
    ];
    if (missingDeps.length > 0) {
      logger.warn('Automatically attaching missing dependencies to this install', {
        moduleList,
        missingDeps,
      });
      const extraMods = missingDeps.map((n: string) =>
        (Object.values(Modules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
      ) as ModuleInterface[];
      mods.push(...extraMods);
      moduleList.push(...extraMods.map(mod => `${mod.name}@${mod.version}`));
      continue;
    }
  } while (missingDeps.length > 0);
  // See if we need to abort because now there's nothing to do
  if (mods.length === 0) {
    logger.warn('All modules already installed', { moduleList });
    return 'Done!';
  }
  // Scan the database and see if there are any collisions
  const tables = (
    await queryRunner.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
  `)
  ).map((t: any) => t.table_name);
  const tableCollisions: { [key: string]: string[] } = {};
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
  .join('\n')}`);
  }
  // We're now good to go with installing the requested modules. To make sure they install correctly
  // we first need to sync the existing modules to make sure there are no records the newly-added
  // modules have a dependency on.
  try {
    await sync(dbId, false, force, orm);
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
      const e = new iasqlModule();
      e.name = `${md.name}@${md.version}`;
      // Promise.all is okay here because it's guaranteed to not hit the cloud services
      e.dependencies = await Promise.all(
        md.dependencies.map(async dep => await orm.findOne(iasqlModule, { name: dep })),
      );
      await orm.save(iasqlModule, e);

      const iasqlTables =
        Modules?.IasqlPlatform?.utils?.IasqlTables ??
        Modules?.iasqlPlatform?.iasqlTables ??
        throwError('Core IasqlModule not found');
      const modTables =
        md?.provides?.tables?.map(t => {
          const mt = new iasqlTables();
          mt.table = t;
          mt.module = e;
          return mt;
        }) ?? [];
      await orm.save(iasqlTables, modTables);
      // For each table, we need to attach the audit log trigger
      for (const table of md?.provides?.tables ?? []) {
        await queryRunner.query(`
          CREATE TRIGGER ${table}_audit
          AFTER INSERT OR UPDATE OR DELETE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION iasql_audit();
        `);
      }
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
  const moduleNames = (await orm.find(iasqlModule)).map((m: any) => m.name);
  const context: Context = { orm, memo: {} }; // Every module gets access to the DB
  for (const name of moduleNames) {
    const md = (Object.values(Modules) as ModuleInterface[]).find(
      m => `${m.name}@${m.version}` === name,
    ) as ModuleInterface;
    if (!md) throw new Error(`This should be impossible. Cannot find module ${name}`);
    const moduleContext = md?.provides?.context ?? {};
    Object.keys(moduleContext).forEach(k => (context[k] = moduleContext[k]));
  }

  try {
    for (const md of rootToLeafOrder) {
      // Get the relevant mappers, which are the ones where the DB is the source-of-truth
      const mappers = Object.values(md.mappers);
      await lazyLoader(
        mappers.map(mapper => async () => {
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
              logger.error(`Error reading from cloud entity ${mapper.entity.name}`, { e, err });
              throw err;
            }
          }
        }),
      );
    }
    return 'Done!';
  } catch (e: any) {
    throw e;
  }
}

export async function uninstall(moduleList: string[], dbId: string, force = false, orm?: TypeormWrapper) {
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (!force && dbMeta?.upgrading) throw new Error('Cannot uninstall modules while upgrading');
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  if (!Modules)
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  // Check to make sure that all specified modules actually exist
  const version =
    Modules?.IasqlPlatform?.version ??
    Modules?.iasqlPlatform?.version ??
    throwError('Core IasqlPlatform not found');
  moduleList = moduleList.map((m: string) => (/@/.test(m) ? m : `${m}@${version}`));
  const mods = moduleList.map((n: string) =>
    (Object.values(Modules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
  ) as ModuleInterface[];
  if (mods.some((m: any) => m === undefined)) {
    throw new Error(
      `The following modules do not exist: ${moduleList
        .filter(
          (n: string) =>
            !(Object.values(Modules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
        )
        .join(', ')}`,
    );
  }
  orm = !orm ? await TypeormWrapper.createConn(dbId) : orm;
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already uninstalled and prune them from the list
  const iasqlModule =
    Modules?.IasqlPlatform?.utils?.IasqlModule ??
    Modules?.iasqlPlatform?.iasqlModule ??
    throwError('Core IasqlModule not found');
  const iasqlTables =
    Modules?.IasqlPlatform?.utils?.IasqlTables ??
    Modules?.iasqlPlatform?.iasqlTables ??
    throwError('Core IasqlTables not found');
  const allInstalledModules = await orm.find(iasqlModule);
  const existingModules = allInstalledModules.map((m: any) => m.name);
  for (let i = 0; i < mods.length; i++) {
    if (!existingModules.includes(`${mods[i].name}@${mods[i].version}`)) {
      mods.splice(i, 1);
      i--;
    }
  }
  // See if we need to abort because now there's nothing to do
  if (mods.length === 0) {
    logger.warn('All modules already uninstalled', { moduleList });
    return 'Done!';
  }
  const remainingModules = existingModules.filter(
    (m: string) => !mods.some(m2 => `${m2.name}@${m2.version}` === m),
  );
  // See if any modules not being uninstalled depend on any of the modules to be uninstalled
  const toUninstall = mods.map(m => `${m.name}@${m.version}`);
  const leftoverModules = allInstalledModules.filter((m: any) => !toUninstall.includes(m.name));
  // Because of TypeORM weirdness with self-referential tables, construct the dependencies array
  // manually. We can do that because we can use the module's dependencies to figure out what they
  // should be
  for (const mod of leftoverModules) {
    const Module: any = Object.values(Modules).find((m: any) => `${m.name}@${m.version}` === mod.name);
    if (!Module) throw new Error(`Somehow ${mod.name} does not have a corresponding module defined`);
    mod.dependencies = [];
    for (const depName of Module.dependencies) {
      const dep = allInstalledModules.find((m: any) => m.name === depName);
      if (!dep) throw new Error(`Somehow ${depName} does not have a corresponding module defined`);
      mod.dependencies.push(dep);
    }
  }
  for (const mod of leftoverModules) {
    if (mod.dependencies.filter((m: any) => toUninstall.includes(m.name)).length > 0) {
      throw new Error(
        `Cannot uninstall ${moduleList.join(', ')} as ${mod.name} still depends on one or more of them`,
      );
    }
  }
  // Sort the modules based on their dependencies, with both root-to-leaf order and vice-versa
  const rootToLeafOrder = sortModules(mods, remainingModules);
  const leafToRootOrder = [...rootToLeafOrder].reverse();
  // Actually run the removal. Running all of the remove scripts from leaf-to-root. Wrapped in a
  // transaction so any failure at this point when we're actually mutating the database doesn't
  // leave things in a busted state.
  await queryRunner.startTransaction();
  try {
    for (const md of leafToRootOrder) {
      // For each table, we need to detach the audit log trigger
      for (const table of md?.provides?.tables ?? []) {
        await queryRunner.query(`
          DROP TRIGGER IF EXISTS ${table}_audit ON ${table};
        `);
      }
      if (md.migrations?.remove) {
        await md.migrations.remove(queryRunner);
      }
      const e = await orm.findOne(iasqlModule, { name: `${md.name}@${md.version}` });
      const mt =
        (await orm.find(iasqlTables, {
          where: {
            module: e,
          },
          relations: ['module'],
        })) ?? [];
      await orm.remove(iasqlTables, mt);
      await orm.remove(iasqlModule, e);
    }
    await queryRunner.commitTransaction();
  } catch (e: any) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
  return 'Done!';
}

// This function is always going to have special-cased logic for it, but hopefully it ends up in a
// few different 'groups' by version number instead of being special-cased for each version.
export async function upgrade(dbId: string, dbUser: string) {
  const versionString = await TypeormWrapper.getVersionString(dbId);
  if (versionString === config.modules.latestVersion) {
    return 'Up to date';
  } else {
    const db = await MetadataRepo.getDbById(dbId);
    if (!db) return 'Database no found (somehow)';
    await MetadataRepo.dbUpgrading(db, true);
    (async () => {
      // First, figure out all of the modules installed, and if the `aws_account` module is
      // installed, also grab those credentials (eventually need to make this distinction and need
      // generalized). But now we then run the `uninstall` code for the old version of the modules,
      // then install with the new versions, with a special 'breakpoint' with `aws_account` if it
      // exists to insert the credentials so the other modules install correctly. (This should also
      // be automated in some way later.)
      let conn: any;
      try {
        conn = await createConnection({
          ...dbMan.baseConnConfig,
          name: dbId,
          database: dbId,
        });
        // 1. Read the `iasql_module` table to get all currently installed modules.
        const mods: string[] = (
          await conn.query(`
          SELECT name FROM iasql_module;
        `)
        ).map((r: any) => r.name.split('@')[0]);
        // 2. Read the `aws_account` table to get the credentials (if any).
        const OldModules = (AllModules as any)[versionString];
        let creds: any;
        // TODO: Drop this old path once v0.0.19 is the oldest version
        if (
          mods.includes('aws_account') &&
          (OldModules?.AwsAccount?.mappers?.awsAccount || OldModules?.awsAccount?.awsAccount)
        ) {
          creds = (
            await conn.query(`
              SELECT access_key_id, secret_access_key, region FROM aws_account LIMIT 1;
          `)
          )[0];
        } else if (mods.includes('aws_account') && OldModules?.awsAccount?.awsRegions) {
          creds = (
            await conn.query(`
              SELECT access_key_id, secret_access_key, region
              FROM aws_credentials c
              INNER JOIN aws_regions r on 1 = 1
              WHERE r.is_default = true;
            `)
          )[0];
        }
        // 3. Uninstall all of the non-`iasql_*` modules
        const nonIasqlMods = mods.filter(m => !/^iasql/.test(m));
        await uninstall(nonIasqlMods, dbId, true);
        // 4. Uninstall the `iasql_*` modules manually
        const qr = conn.createQueryRunner();
        await OldModules?.IasqlFunctions?.migrations?.remove(qr);
        await OldModules?.iasqlFunctions?.migrations?.remove(qr);
        await OldModules?.IasqlPlatform?.migrations?.remove(qr);
        await OldModules?.iasqlPlatform?.migrations?.remove(qr);
        // 5. Install the new `iasql_*` modules manually
        const NewModules = AllModules[config.modules.latestVersion];
        await NewModules?.IasqlPlatform?.migrations?.install(qr);
        await NewModules?.iasqlPlatform?.migrations?.install(qr);
        await NewModules?.IasqlFunctions?.migrations?.install(qr);
        await NewModules?.iasqlFunctions?.migrations?.install(qr);
        await conn.query(`
          INSERT INTO iasql_module (name) VALUES ('iasql_platform@${config.modules.latestVersion}'), ('iasql_functions@${config.modules.latestVersion}');
          INSERT INTO iasql_dependencies (module, dependency) VALUES ('iasql_functions@${config.modules.latestVersion}', 'iasql_platform@${config.modules.latestVersion}');
        `);
        // 6. Install the `aws_account` module and then re-insert the creds if present, then add
        //    the rest of the modules back.
        if (!!creds) {
          await install(['aws_account'], dbId, dbUser, false, true);
          await conn.query(`
            INSERT INTO aws_credentials (access_key_id, secret_access_key)
            VALUES ('${creds.access_key_id}', '${creds.secret_access_key}');
          `);
          await sync(dbId, false);
          if (creds.region) {
            await conn.query(`
              UPDATE aws_regions SET is_default = true WHERE region = '${creds.region}';
            `);
          }
          await install(
            mods.filter((m: string) => !['aws_account', 'iasql_platform', 'iasql_functions'].includes(m)),
            dbId,
            dbUser,
            false,
            true,
          );
        }
      } catch (e) {
        logger.error('Failed to upgrade', { e });
      } finally {
        conn?.close();
        await MetadataRepo.dbUpgrading(db, false);
      }
    })();
    return 'Upgrading. Please disconnect and reconnect to the database';
  }
}
