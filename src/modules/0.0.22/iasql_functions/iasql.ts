import * as levenshtein from 'fastest-levenshtein';
import { default as cloneDeep } from 'lodash.clonedeep';
import { Not, In, Between, LessThan, MoreThan } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { camelCase, snakeCase } from 'typeorm/util/StringUtils';

import config from '../../../config';
import { throwError } from '../../../config/config';
import { modules as AllModules } from '../../../modules';
import { Context, MapperInterface, ModuleInterface, MapperBase } from '../../../modules';
import * as dbMan from '../../../services/db-manager';
import { findDiff } from '../../../services/diff';
import { DepError, lazyLoader } from '../../../services/lazy-dep';
import logger, { debugObj } from '../../../services/logger';
import { sortModules } from '../../../services/mod-sort';
import MetadataRepo from '../../../services/repositories/metadata';
import * as scheduler from '../../../services/scheduler-api';
import { TypeormWrapper } from '../../../services/typeorm';
import { AuditLogChangeType, IasqlAuditLog, IasqlModule } from '../iasql_platform/entity';

// The last part of the upgrade method needs to call install and sync on the database. These method calls
// will be running in this file, but they should use the latest version to ensure the new DB is initialized
// with the correct version.
// tslint:disable-next-line:no-var-requires
const upgradedIasql = require(`../../${config.modules.latestVersion}/iasql_functions/iasql`);

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
    const iasqlModule = Modules?.iasqlPlatform?.iasqlModule ?? throwError('Core IasqlModule not found');
    const moduleNames = (await orm.find(iasqlModule)).map((m: any) => m.name);
    // Get the relevant mappers, which are the ones where the DB is the source-of-truth
    const moduleList = (Object.values(Modules) as ModuleInterface[]).filter(mod =>
      moduleNames.includes(`${mod.name}@${mod.version}`),
    );
    const rootToLeafOrder = sortModules(moduleList, []);
    const mappers = (rootToLeafOrder as ModuleInterface[])
      .map(mod => Object.values(mod))
      .flat()
      .filter(val => val instanceof MapperBase)
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
    const iasqlModule = Modules?.iasqlPlatform?.iasqlModule ?? throwError('Core IasqlModule not found');
    const moduleNames = (await orm.find(iasqlModule)).map((m: any) => m.name);
    // Get the mappers, regardless of source-of-truth
    const moduleList = (Object.values(Modules) as ModuleInterface[]).filter(mod =>
      moduleNames.includes(`${mod.name}@${mod.version}`),
    );
    const rootToLeafOrder = sortModules(moduleList, []);
    const mappers = (rootToLeafOrder as ModuleInterface[])
      .map(mod => Object.values(mod))
      .flat()
      .filter(val => val instanceof MapperBase)
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
  await throwIfUpgrading(dbId, false);
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  if (!Modules)
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  const allModules = Object.values(Modules)
    .filter(
      (m: any) => m.hasOwnProperty('dependencies') && m.hasOwnProperty('name') && !/iasql_.*/.test(m.name),
    )
    .map((m: any) => ({
      moduleName: m.name,
      moduleVersion: m.version,
      dependencies: m.dependencies.filter((d: any) => !/iasql_.*/.test(d)),
    }));
  if (all) {
    // TODO: Remove this filter once two-way mode is standard
    return allModules.filter(
      (m: any) => !['aws_codebuild', 'aws_codedeploy', 'aws_codepipeline'].includes(m.name),
    );
  } else if (installed && dbId) {
    const iasqlModule = Modules?.iasqlPlatform?.iasqlModule ?? throwError('Core IasqlModule not found');
    const iasqlTables = Modules?.iasqlPlatform?.iasqlTables ?? throwError('Core IasqlTables not found');
    const entities: Function[] = [iasqlModule, iasqlTables];
    const orm = await TypeormWrapper.createConn(dbId, { entities } as PostgresConnectionOptions);
    const mods = await orm.find(iasqlModule);
    const modsInstalled = mods.map((m: any) => m.name);
    return allModules.filter(m => modsInstalled.includes(`${m.moduleName}@${m.moduleVersion}`));
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
  syncContext?: Context,
  ormOpt?: TypeormWrapper,
) {
  await throwIfUpgrading(dbId, force);
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  if (!Modules)
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  // Check to make sure that all specified modules actually exist
  if (allModules) {
    const installedModules = (await modules(false, true, dbId)).map((r: any) => r.moduleName);
    moduleList = (Object.values(Modules) as ModuleInterface[])
      .filter((m: ModuleInterface) => !installedModules.includes(m.name))
      .filter(
        (m: ModuleInterface) =>
          m.name && m.version && !['iasql_platform', 'iasql_functions'].includes(m.name),
      )
      .map((m: ModuleInterface) => `${m.name}@${m.version}`);
  }
  const version = Modules?.iasqlPlatform?.version ?? throwError('IasqlPlatform not found');
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
  const iasqlModule = Modules?.iasqlPlatform?.iasqlModule ?? throwError('Core IasqlModule not found');
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
    await commit(dbId, false, syncContext ?? { memo: {}, orm }, force, orm);
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
      if (md.migrations?.beforeInstall) {
        await md.migrations.beforeInstall(queryRunner);
      }
      if (md.migrations?.install) {
        await md.migrations.install(queryRunner);
      }
      if (md.migrations?.afterInstall) {
        await md.migrations.afterInstall(queryRunner);
      }
      const e = new iasqlModule();
      e.name = `${md.name}@${md.version}`;
      // Promise.all is okay here because it's guaranteed to not hit the cloud services
      e.dependencies = await Promise.all(
        md.dependencies.map(async dep => await orm.findOne(iasqlModule, { name: dep })),
      );
      await orm.save(iasqlModule, e);

      const iasqlTables = Modules?.iasqlPlatform?.iasqlTables ?? throwError('Core IasqlModule not found');
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
    await orm.query(dbMan.grantPostgresGroupRoleQuery(dbUser, dbId, versionString));
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
    Object.keys(moduleContext).forEach(k => {
      if (typeof moduleContext[k] === 'function') {
        context[k] = moduleContext[k];
      } else {
        context[k] = cloneDeep(moduleContext[k]);
      }
    });
  }

  try {
    for (const md of rootToLeafOrder) {
      // Get the relevant mappers, which are the ones where the DB is the source-of-truth
      const mappers = Object.values(md).filter(val => val instanceof MapperBase);
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
  await throwIfUpgrading(dbId, force);
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const Modules = (AllModules as any)[versionString];
  if (!Modules)
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  // Check to make sure that all specified modules actually exist
  const version = Modules?.iasqlPlatform?.version ?? throwError('Core IasqlPlatform not found');
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
  const iasqlModule = Modules?.iasqlPlatform?.iasqlModule ?? throwError('Core IasqlModule not found');
  const iasqlTables = Modules?.iasqlPlatform?.iasqlTables ?? throwError('Core IasqlTables not found');
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
      if (md.migrations?.beforeRemove) {
        await md.migrations.beforeRemove(queryRunner);
      }
      if (md.migrations?.remove) {
        await md.migrations.remove(queryRunner);
      }
      if (md.migrations?.afterRemove) {
        await md.migrations.afterRemove(queryRunner);
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
export async function upgrade(dbId: string, dbUser: string, context: Context) {
  const versionString = await TypeormWrapper.getVersionString(dbId);
  if (versionString === config.modules.latestVersion) {
    return 'Up to date';
  } else {
    const db = await MetadataRepo.getDbById(dbId);
    if (!db) return 'Database no found (somehow)';
    await MetadataRepo.dbUpgrading(db, true);
    (async () => {
      // We need to sleep for a bit to let the scheduler response execute before we start messing up with the db
      await new Promise(r => setTimeout(r, 5000));
      // First, figure out all of the modules installed, and if the `aws_account` module is
      // installed, also grab those credentials (eventually need to make this distinction and need
      // generalized). But now we then run the `uninstall` code for the old version of the modules,
      // then install with the new versions, with a special 'breakpoint' with `aws_account` if it
      // exists to insert the credentials so the other modules install correctly. (This should also
      // be automated in some way later.)
      let conn: TypeormWrapper | null = null;
      try {
        conn = await TypeormWrapper.createConn(dbId);
        // 1. Read the `iasql_module` table to get all currently installed modules.
        const mods: string[] = (
          await conn.query(`
          SELECT name FROM iasql_module;
        `)
        ).map((r: any) => r.name.split('@')[0]);
        // 2. Read the `aws_account` table to get the credentials (if any).
        const OldModules = (AllModules as any)[versionString];
        let creds: any;
        // TODO: Drop this old path once v0.0.20 is the oldest version
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
        let qr = conn.createQueryRunner();
        if (OldModules?.iasqlFunctions?.migrations?.beforeRemove) {
          await OldModules?.iasqlFunctions?.migrations?.beforeRemove(qr);
        }
        await OldModules?.iasqlFunctions?.migrations?.remove(qr);
        if (OldModules?.iasqlFunctions?.migrations?.afterRemove) {
          await OldModules?.iasqlFunctions?.migrations?.afterRemove(qr);
        }
        if (OldModules?.iasqlPlatform?.migrations?.beforeRemove) {
          await OldModules?.iasqlPlatform?.migrations?.beforeRemove(qr);
        }
        await OldModules?.iasqlPlatform?.migrations?.remove(qr);
        if (OldModules?.iasqlPlatform?.migrations?.afterRemove) {
          await OldModules?.iasqlPlatform?.migrations?.afterRemove(qr);
        }
        // close previous connection and create a new one
        await conn?.dropConn();
        conn = await TypeormWrapper.createConn(dbId);
        // update the context to use the new connection
        context.orm = conn;
        qr = conn.createQueryRunner();
        // 5. Install the new `iasql_*` modules manually
        const NewModules = AllModules[config.modules.latestVersion];
        if (NewModules?.iasqlPlatform?.migrations?.beforeInstall) {
          await NewModules?.iasqlPlatform?.migrations?.beforeInstall(qr);
        }
        await NewModules?.iasqlPlatform?.migrations?.install(qr);
        if (NewModules?.iasqlPlatform?.migrations?.afterInstall) {
          await NewModules?.iasqlPlatform?.migrations?.afterInstall(qr);
        }
        if (NewModules?.iasqlFunctions?.migrations?.beforeInstall) {
          await NewModules?.iasqlFunctions?.migrations?.beforeInstall(qr);
        }
        await NewModules?.iasqlFunctions?.migrations?.install(qr);
        if (NewModules?.iasqlFunctions?.migrations?.afterInstall) {
          await NewModules?.iasqlFunctions?.migrations?.afterInstall(qr);
        }
        await conn.query(`
          INSERT INTO iasql_module (name) VALUES ('iasql_platform@${config.modules.latestVersion}'), ('iasql_functions@${config.modules.latestVersion}');
          INSERT INTO iasql_dependencies (module, dependency) VALUES ('iasql_functions@${config.modules.latestVersion}', 'iasql_platform@${config.modules.latestVersion}');
        `);
        // 6. Install the `aws_account` module and then re-insert the creds if present, then add
        //    the rest of the modules back.
        if (!!creds) {
          await upgradedIasql.continueUpgrade(dbId, dbUser, context, creds, mods);
        }
      } catch (e) {
        logger.error('Failed to upgrade', { e });
      } finally {
        conn?.dropConn();
        // Restart the scheduler
        scheduler.start(dbId, dbUser);
        await MetadataRepo.dbUpgrading(db, false);
      }
    })();
    return 'Upgrading. Please disconnect and reconnect to the database';
  }
}

export async function continueUpgrade(
  dbId: string,
  dbUser: string,
  context: Context,
  creds: any,
  mods: string[],
) {
  await install(['aws_account'], dbId, dbUser, false, true);
  await context.orm.query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${creds.access_key_id}', '${creds.secret_access_key}');
  `);
  const orm = context.orm;
  await commit(dbId, false, context, true);
  context.orm = orm;
  if (creds.region) {
    await context.orm.query(`
      UPDATE aws_regions SET is_default = true WHERE region = '${creds.region}';
    `);
  }
  const modsToInstall = new Set<string>();
  mods.forEach((m: string) => {
    if (['aws_account', 'iasql_platform', 'iasql_functions'].includes(m)) return;
    // ACM logic not necessary after v0.0.22 is the last supported version
    if (['aws_acm_list', 'aws_acm_import', 'aws_acm_request'].includes(m)) {
      return modsToInstall.add('aws_acm');
    }
    // Renamed `aws_route53_hosted_zones` to just `aws_route53`
    if (m === 'aws_route53_hosted_zones') return modsToInstall.add('aws_route53');
    modsToInstall.add(m);
  });
  await install([...modsToInstall.values()], dbId, dbUser, false, true);
}

export async function commit(
  dbId: string,
  dryRun: boolean,
  context: Context,
  force = false,
  ormOpt?: TypeormWrapper,
) {
  const t1 = Date.now();
  logger.info(`Commiting to ${dbId}`);
  await throwIfUpgrading(dbId, force);
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const importedModules = await getImportedModules(dbId, versionString, force);
  let orm: TypeormWrapper | null = null;
  try {
    orm = ormOpt ? ormOpt : await TypeormWrapper.createConn(dbId);
    context.orm = orm;
    const newStartCommit = await insertCommit(orm, dryRun ? 'preview_start' : 'start');
    if (dryRun) context.previewStartCommit = newStartCommit;
    else context.startCommit = newStartCommit;
    const previousStartCommit = await getPreviousStartCommit(orm, newStartCommit.ts);
    const changesToCommit: IasqlAuditLog[] = await orm.find(IasqlAuditLog, {
      order: { ts: 'DESC' },
      where: {
        changeType: Not(
          In([
            AuditLogChangeType.START_COMMIT,
            AuditLogChangeType.PREVIEW_START_COMMIT,
            AuditLogChangeType.END_COMMIT,
            AuditLogChangeType.PREVIEW_END_COMMIT,
          ]),
        ),
        ts: previousStartCommit
          ? Between(previousStartCommit.ts, newStartCommit.ts)
          : LessThan(newStartCommit.ts),
        user: Not(config.db.user),
      },
    });
    const tablesWithChanges = [...new Set(changesToCommit.map(c => c.tableName))];
    const changesByEntity: { [key: string]: any[] } = getChangesByEntity(changesToCommit);

    const installedModulesNames = (await orm.find(IasqlModule)).map((m: any) => m.name);
    const installedModules: ModuleInterface[] = (Object.values(importedModules) as ModuleInterface[]).filter(
      mod => installedModulesNames.includes(`${mod.name}@${mod.version}`),
    );

    const modulesWithChanges: ModuleInterface[] = getModulesWithChanges(
      importedModules,
      installedModules,
      installedModulesNames,
      tablesWithChanges,
      versionString,
    );
    const t2 = Date.now();
    logger.info(`Setup took ${t2 - t1}ms`);

    const toCreate: Crupde = {};
    const toUpdate: Crupde = {};
    const toReplace: Crupde = {}; // Not actually used in sync mode, at least right now
    const toDelete: Crupde = {};
    const modulesWithChangesSorted: ModuleInterface[] = sortModules(
      modulesWithChanges,
      installedModulesNames,
    );
    const installedModulesSorted: ModuleInterface[] = sortModules(installedModules, installedModulesNames);
    try {
      if (modulesWithChanges.length) {
        const applyRes = await commitApply(
          dbId,
          modulesWithChangesSorted,
          context,
          toCreate,
          toUpdate,
          toReplace,
          toDelete,
          dryRun,
          changesByEntity,
        );
        if (dryRun) return applyRes;
      }
    } catch (e) {
      return await commitApply(
        dbId,
        installedModulesSorted,
        context,
        toCreate,
        toUpdate,
        toReplace,
        toDelete,
        dryRun,
      );
    }
    return await commitSync(
      dbId,
      installedModulesSorted,
      context,
      toCreate,
      toUpdate,
      toReplace,
      toDelete,
      dryRun,
    );
  } catch (e: any) {
    debugObj(e);
    throw e;
  } finally {
    // Create end commit object
    await insertCommit(orm, dryRun ? 'preview_end' : 'end');
    // do not drop the conn if it was provided
    if (orm !== ormOpt) orm?.dropConn();
  }
}

async function throwIfUpgrading(dbId: string, force: boolean) {
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (!force && dbMeta?.upgrading) throw new Error('The database is upgrading. Please try again later.');
}

async function getImportedModules(dbId: string, versionString: string, force: boolean) {
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (!force && dbMeta?.upgrading) throw new Error('Cannot apply a change while upgrading');
  const importedModules = (AllModules as any)[versionString];
  if (!importedModules) {
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  }
  return importedModules;
}

async function insertCommit(
  orm: TypeormWrapper | null,
  type: 'start' | 'preview_start' | 'end' | 'preview_end',
) {
  const commitLog = new IasqlAuditLog();
  commitLog.user = config.db.user;
  commitLog.change = {};
  switch (type) {
    case 'start':
      commitLog.changeType = AuditLogChangeType.START_COMMIT;
      break;
    case 'preview_start':
      commitLog.changeType = AuditLogChangeType.PREVIEW_START_COMMIT;
      break;
    case 'end':
      commitLog.changeType = AuditLogChangeType.END_COMMIT;
      break;
    case 'preview_end':
      commitLog.changeType = AuditLogChangeType.PREVIEW_END_COMMIT;
      break;
    default:
      break;
  }
  commitLog.tableName = 'iasql_audit_log';
  commitLog.ts = new Date();
  await orm?.save(IasqlAuditLog, commitLog);
  return commitLog;
}

async function getPreviousStartCommit(orm: TypeormWrapper, currentTs: Date): Promise<IasqlAuditLog | null> {
  // Find 'START_COMMIT's and pick the first element since it should be the previous one to the ts we have just inserted
  const startCommits = await orm.find(IasqlAuditLog, {
    order: { ts: 'DESC' },
    skip: 0,
    take: 2,
    where: {
      changeType: AuditLogChangeType.START_COMMIT,
      ts: LessThan(currentTs),
    },
  });
  return startCommits.length > 0 ? startCommits[0] : null;
}

function getChangesByEntity(changesToCommit: IasqlAuditLog[]): { [key: string]: any[] } {
  const changesByEntity: { [key: string]: any[] } = {};
  changesToCommit.forEach((c: IasqlAuditLog) => {
    const camelCaseEntityName = camelCase(c.tableName);
    const entityName = camelCaseEntityName.charAt(0).toUpperCase() + camelCaseEntityName.slice(1);
    const entity: any = {};
    if (c.changeType === AuditLogChangeType.DELETE) {
      Object.entries(c.change.original).forEach(([k, v]: [string, any]) => (entity[camelCase(k)] = v));
    } else if ([AuditLogChangeType.INSERT, AuditLogChangeType.UPDATE].includes(c.changeType)) {
      Object.entries(c.change.change).forEach(([k, v]: [string, any]) => (entity[camelCase(k)] = v));
    }
    changesByEntity[entityName] = changesByEntity[entityName] ?? [];
    changesByEntity[entityName].push(entity);
  });
  return changesByEntity;
}

function getModulesWithChanges(
  importedModules: any,
  installedModules: ModuleInterface[],
  installedModulesNames: string[],
  tablesWithChanges: string[],
  versionString: string,
) {
  const modulesDirectlyAffected: ModuleInterface[] = installedModules.filter(mod =>
    mod.provides?.tables?.some((t: string) => tablesWithChanges.includes(t)),
  );
  const modulesDirectlyAffectedDepsNames = [
    ...new Set(
      modulesDirectlyAffected
        .flatMap((m: ModuleInterface) => m.dependencies.filter(d => !installedModulesNames.includes(d)))
        .filter(
          (m: any) =>
            ![`iasql_platform@${versionString}`, `iasql_functions@${versionString}`].includes(m) &&
            m !== undefined,
        ),
    ),
  ];
  const modulesIndirectlyAffected = modulesDirectlyAffectedDepsNames.map((n: string) =>
    (Object.values(importedModules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
  ) as ModuleInterface[];

  return [...modulesDirectlyAffected, ...modulesIndirectlyAffected];
}

async function commitSync(
  dbId: string,
  relevantModules: ModuleInterface[],
  context: Context,
  toCreate: Crupde,
  toUpdate: Crupde,
  toReplace: Crupde,
  toDelete: Crupde,
  dryRun: boolean,
): Promise<{ iasqlPlanVersion: number; rows: any[] }> {
  const t1 = Date.now();
  const mappers = relevantModules
    .map(mod => Object.values(mod))
    .flat()
    .filter(val => val instanceof MapperBase)
    .flat();
  let ranFullUpdate = false;
  let failureCount = -1;
  let dbCount = -1;
  let cloudCount = -1;
  let bothCount = -1;
  let spinCount = 0;
  do {
    const t2 = Date.now();
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
      // Every time we read from db we get possible changes that occured after this commit started
      const changesAfterCommitByEntity = await getChangesAfterCommitStartedByEntity(context);
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
            !crupde[entityName].some(r2 => Object.is(r2.id, r.id) && Object.is(r2.description, r.description))
          )
            crupde[entityName].push(r);
        });
      };
      records.forEach(r => {
        r.diff = findDiff(r.dbEntity, r.cloudEntity, r.idGen, r.comparator);
        // Only filter changes that might have occured after this commit started
        r.diff.entitiesInAwsOnly = r.diff.entitiesInAwsOnly.filter(
          (e: any) => !changesAfterCommitByEntity[r.table]?.find(re => r.idGen(e) === r.idGen(re)),
        );
        r.diff.entitiesInDbOnly = r.diff.entitiesInDbOnly.filter(
          (e: any) => !changesAfterCommitByEntity[r.table]?.find(re => r.idGen(e) === r.idGen(re)),
        );
        r.diff.entitiesChanged = r.diff.entitiesChanged.filter(
          (o: any) => !changesAfterCommitByEntity[r.table]?.find(re => r.idGen(o.db) === r.idGen(re)),
        );
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
}

async function commitApply(
  dbId: string,
  relevantModules: ModuleInterface[],
  context: Context,
  toCreate: Crupde,
  toUpdate: Crupde,
  toReplace: Crupde,
  toDelete: Crupde,
  dryRun: boolean,
  changesByEntity?: { [key: string]: any[] },
): Promise<{ iasqlPlanVersion: number; rows: any[] }> {
  const t1 = Date.now();
  const mappers = relevantModules
    .map(mod => Object.values(mod))
    .flat()
    .filter(val => val instanceof MapperBase)
    .flat()
    .filter(mapper => mapper.source === 'db');
  let ranFullUpdate = false;
  let failureCount = -1;
  let dbCount = -1;
  let cloudCount = -1;
  let bothCount = -1;
  let spinCount = 0;
  do {
    const t2 = Date.now();
    logger.info('Starting outer loop');
    ranFullUpdate = false;
    const tables = mappers.map(mapper => mapper.entity.name);
    context.memo.db = {}; // Flush the DB entities on the outer loop to restore the actual intended state
    await lazyLoader(
      mappers.map(mapper => async () => {
        await mapper.db.read(context);
      }),
    );
    // Every time we read from db we get possible changes that occured after this commit started
    const changesAfterCommitByEntity = await getChangesAfterCommitStartedByEntity(context);
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
            !crupde[entityName].some(r2 => Object.is(r2.id, r.id) && Object.is(r2.description, r.description))
          )
            crupde[entityName].push(r);
        });
      };
      records.forEach(r => {
        r.diff = findDiff(r.dbEntity, r.cloudEntity, r.idGen, r.comparator);
        // If we have changes to apply only filter those, if not, filter chnages done after this commit started
        if (changesByEntity) {
          // Case entities in DB only: we want to create in the cloud.
          // We need to filter which of those are the changes we are taking into account. Otherwise we could be applying changes from other cycle.
          r.diff.entitiesInDbOnly = r.diff.entitiesInDbOnly.filter((e: any) =>
            changesByEntity[r.table]?.find(re => r.idGen(e) === r.idGen(re)),
          );
          // Case entities in AWS only: we want to delete from the cloud.
          // We need to filter which of those are the changes we are taking into account. Otherwise we could be applying changes from other cycle.
          r.diff.entitiesInAwsOnly = r.diff.entitiesInAwsOnly.filter((e: any) =>
            changesByEntity[r.table]?.find(re => r.idGen(e) === r.idGen(re)),
          );
          // Case entities changed: we want to update/restore/replace to/from the cloud.
          // We need to filter which of those are the changes we are taking into account. Otherwise we could be applying changes from other cycle.
          r.diff.entitiesChanged = r.diff.entitiesChanged.filter((o: any) =>
            changesByEntity[r.table]?.find(re => r.idGen(o.db) === r.idGen(re)),
          );
        } else {
          r.diff.entitiesInAwsOnly = r.diff.entitiesInAwsOnly.filter(
            (e: any) => !changesAfterCommitByEntity[r.table]?.find(re => r.idGen(e) === r.idGen(re)),
          );
          r.diff.entitiesInDbOnly = r.diff.entitiesInDbOnly.filter(
            (e: any) => !changesAfterCommitByEntity[r.table]?.find(re => r.idGen(e) === r.idGen(re)),
          );
          r.diff.entitiesChanged = r.diff.entitiesChanged.filter(
            (o: any) => !changesAfterCommitByEntity[r.table]?.find(re => r.idGen(o.db) === r.idGen(re)),
          );
        }
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
}

async function getChangesAfterCommitStartedByEntity(context: Context): Promise<{ [key: string]: any[] }> {
  const changesAfterCommit: IasqlAuditLog[] = await context.orm.find(IasqlAuditLog, {
    order: { ts: 'DESC' },
    where: {
      changeType: Not(
        In([
          AuditLogChangeType.START_COMMIT,
          AuditLogChangeType.PREVIEW_START_COMMIT,
          AuditLogChangeType.END_COMMIT,
          AuditLogChangeType.PREVIEW_END_COMMIT,
        ]),
      ),
      ts: MoreThan(context.startCommit?.ts ?? context.previewStartCommit?.ts),
      user: Not(config.db.user),
    },
  });
  return getChangesByEntity(changesAfterCommit);
}

export async function rollback(dbId: string, context: Context, force = false, ormOpt?: TypeormWrapper) {
  const t1 = Date.now();
  logger.info(`Sync to ${dbId}`);
  await throwIfUpgrading(dbId, force);
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const importedModules = await getImportedModules(dbId, versionString, force);
  let orm: TypeormWrapper | null = null;
  try {
    orm = ormOpt ? ormOpt : await TypeormWrapper.createConn(dbId);
    context.orm = orm;
    const newStartCommit = await insertCommit(orm, 'start');
    context.startCommit = newStartCommit;

    const installedModulesNames = (await orm.find(IasqlModule)).map((m: any) => m.name);
    const installedModules: ModuleInterface[] = (Object.values(importedModules) as ModuleInterface[]).filter(
      mod => installedModulesNames.includes(`${mod.name}@${mod.version}`),
    );

    const t2 = Date.now();
    logger.info(`Setup took ${t2 - t1}ms`);

    const toCreate: Crupde = {};
    const toUpdate: Crupde = {};
    const toReplace: Crupde = {}; // Not actually used in sync mode, at least right now
    const toDelete: Crupde = {};
    const installedModulesSorted: ModuleInterface[] = sortModules(installedModules, installedModulesNames);
    return await commitSync(
      dbId,
      installedModulesSorted,
      context,
      toCreate,
      toUpdate,
      toReplace,
      toDelete,
      false,
    );
  } catch (e: any) {
    debugObj(e);
    throw e;
  } finally {
    // Create end commit object
    await insertCommit(orm, 'end');
    // do not drop the conn if it was provided
    if (orm !== ormOpt) orm?.dropConn();
  }
}
