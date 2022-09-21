import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { snakeCase } from 'typeorm/util/StringUtils';

import { throwError } from '../../../config/config';
import { modules as AllModules } from '../../../modules';
import { Context, MapperInterface, ModuleInterface } from '../../../modules';
import { findDiff } from '../../../services/diff';
import { DepError, lazyLoader } from '../../../services/lazy-dep';
import logger, { debugObj } from '../../../services/logger';
import { sortModules } from '../../../services/mod-sort';
import MetadataRepo from '../../../services/repositories/metadata';
import { TypeormWrapper } from '../../../services/typeorm';

// Crupde = CR-UP-DE, Create/Update/Delete
type Crupde = { [key: string]: { id: string; description: string }[] };
export function recordCount(records: { [key: string]: any }[]): [number, number, number] {
  const dbCount = records.reduce((cumu, r) => cumu + r.diff.entitiesInDbOnly.length, 0);
  const cloudCount = records.reduce((cumu, r) => cumu + r.diff.entitiesInAwsOnly.length, 0);
  const bothCount = records.reduce((cumu, r) => cumu + r.diff.entitiesChanged.length, 0);
  return [dbCount, cloudCount, bothCount];
}

const iasqlPlanV3 = (toCreate: Crupde, toUpdate: Crupde, toReplace: Crupde, toDelete: Crupde) => ({
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

export async function apply(dbId: string, dryRun: boolean, context: Context, ormOpt?: TypeormWrapper) {
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
    // Find all of the installed modules
    const iasqlModule =
      Modules?.IasqlPlatform?.utils?.IasqlModule ??
      Modules?.iasqlPlatform?.iasqlModule ??
      throwError('Core IasqlModule not found');
    const moduleNames = (await orm.find(iasqlModule)).map((m: any) => m.name);
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
      context.memo.db = {}; // Flush the DB entities on the outer loop to restore the actual intended state
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
        context.memo.cloud = {}; // Flush the Cloud entities on the inner loop to track changes to the state
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
          dbEntity: tables.map(t => (context.memo.db[t] ? Object.values(context.memo.db[t]) : [])),
          cloudEntity: tables.map(t => (context.memo.cloud[t] ? Object.values(context.memo.cloud[t]) : [])),
          comparator: comparators,
          idGen: idGens,
        });
        const t4 = Date.now();
        logger.info(`AWS Mapping time: ${t4 - t3}ms`);
        if (!records.length) {
          // Only possible on just-created databases
          return {
            iasqlPlanVersion: 3,
            rows: [],
          };
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

export async function sync(
  dbId: string,
  dryRun: boolean,
  force = false,
  context: Context,
  ormOpt?: TypeormWrapper,
) {
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
    // Find all of the installed modules
    const iasqlModule =
      Modules?.IasqlPlatform?.utils?.IasqlModule ??
      Modules?.iasqlPlatform?.iasqlModule ??
      throwError('Core IasqlModule not found');
    const moduleNames = (await orm.find(iasqlModule)).map((m: any) => m.name);
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
      context.memo.cloud = {}; // Flush the cloud entities on the outer loop to restore the actual intended state
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
        context.memo.db = {}; // Flush the DB entities on the inner loop to track changes to the state
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
          dbEntity: tables.map(t => (context.memo.db[t] ? Object.values(context.memo.db[t]) : [])),
          cloudEntity: tables.map(t => (context.memo.cloud[t] ? Object.values(context.memo.cloud[t]) : [])),
          comparator: comparators,
          idGen: idGens,
        });
        const t4 = Date.now();
        logger.info(`AWS Mapping time: ${t4 - t3}ms`);
        if (!records.length) {
          // Only possible on just-created databases
          return {
            iasqlPlanVersion: 3,
            rows: [],
          };
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
    .map((m: any) => ({
      moduleName: m.name,
      moduleVersion: m.version,
      dependencies: m.dependencies.filter((d: any) => !/iasql_.*/.test(d)),
    }));
  if (all) {
    return allModules;
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
    return allModules.filter(m => modsInstalled.includes(`${m.moduleName}@${m.moduleVersion}`));
  } else {
    throw new Error('Invalid request parameters');
  }
}
