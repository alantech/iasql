import * as levenshtein from 'fastest-levenshtein';
import { default as cloneDeep } from 'lodash.clonedeep';
import format from 'pg-format';
import { Between, EntityMetadata, In, IsNull, LessThan, MoreThan, Not } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import { camelCase, snakeCase } from 'typeorm/util/StringUtils';
import { v4 as uuidv4 } from 'uuid';

import config from '../../config';
import { throwError } from '../../config/config';
import { Context, MapperBase, MapperInterface, ModuleInterface } from '../../modules';
import { getCloudId } from '../../services/cloud-id';
import { findDiff } from '../../services/diff';
import { DepError, lazyLoader } from '../../services/lazy-dep';
import logger, { debugObj, logErrSentry, mergeErrorMessages } from '../../services/logger';
import { sortModules } from '../../services/mod-sort';
import MetadataRepo from '../../services/repositories/metadata';
import * as telemetry from '../../services/telemetry';
import { TypeormWrapper } from '../../services/typeorm';
import { AuditLogChangeType, IasqlAuditLog, IasqlModule } from '../iasql_platform/entity';
import * as AllModules from '../index';

// Crupde = CR-UP-DE, Create/Update/Delete
type Crupde = { [key: string]: { id: string; description: string }[] };
type CrupdeOperations = { toCreate: Crupde; toUpdate: Crupde; toReplace: Crupde; toDelete: Crupde };

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

export async function modules(all: boolean, installed: boolean, dbId: string) {
  await throwIfUpgrading(dbId, false);
  const allModules = Object.values(AllModules)
    .filter((m: any) => m.hasOwnProperty('dependencies') && m.hasOwnProperty('name'))
    .map((m: any) => ({
      moduleName: m.name,
      moduleVersion: m.version,
      dependencies: m.dependencies,
    }));
  if (all) {
    return allModules;
  } else if (installed && dbId) {
    const iasqlModule = AllModules?.iasqlPlatform?.iasqlModule ?? throwError('Core IasqlModule not found');
    const iasqlTables = AllModules?.iasqlPlatform?.iasqlTables ?? throwError('Core IasqlTables not found');
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
  _dbUser: string,
  allModules = false,
  force = false,
  syncContext?: Context,
  ormOpt?: TypeormWrapper,
) {
  await throwIfUpgrading(dbId, force);
  // Check to make sure that all specified modules actually exist
  if (allModules) {
    const installedModules = (await modules(false, true, dbId)).map((r: any) => r.moduleName);
    moduleList = (Object.values(AllModules) as ModuleInterface[])
      .filter((m: ModuleInterface) => !installedModules.includes(m.name))
      .filter(
        (m: ModuleInterface) =>
          m.name && m.version && !['iasql_platform', 'iasql_functions'].includes(m.name),
      )
      .map((m: ModuleInterface) => `${m.name}@${m.version}`);
  }
  // ignore duplicated modules in moduleList
  moduleList = [...new Set(moduleList)];
  const version = AllModules?.iasqlPlatform?.version ?? throwError('IasqlPlatform not found');
  const versionString = await TypeormWrapper.getVersionString(dbId);
  if (version !== versionString) throw new Error(`Unsupported version ${versionString}`);
  moduleList = moduleList.map((m: string) => (/@/.test(m) ? m : `${m}@${version}`));
  const mods = moduleList.map((n: string) =>
    (Object.values(AllModules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
  ) as ModuleInterface[];
  if (mods.some((m: any) => m === undefined)) {
    const modNames = (Object.values(AllModules) as ModuleInterface[])
      .filter(m => m.hasOwnProperty('name') && m.hasOwnProperty('version'))
      .map(m => `${m.name}@${m.version}`);
    const missingModules = moduleList.filter(
      (n: string) =>
        !(Object.values(AllModules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
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
  const iasqlModule = AllModules?.iasqlPlatform?.iasqlModule ?? throwError('Core IasqlModule not found');
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
      logger.scope({ dbId }).warn('Automatically attaching missing dependencies to this install', {
        moduleList,
        missingDeps,
      });
      const extraMods = missingDeps.map((n: string) =>
        (Object.values(AllModules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
      ) as ModuleInterface[];
      mods.push(...extraMods);
      moduleList.push(...extraMods.map(mod => `${mod.name}@${mod.version}`));
      continue;
    }
  } while (missingDeps.length > 0);
  // See if we need to abort because now there's nothing to do
  if (mods.length === 0) {
    logger.scope({ dbId }).warn('All modules already installed', { moduleList });
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
    logger.scope({ dbId }).error('Sync during module install failed', e);
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
        md.dependencies.map(async dep => await orm.findOne(iasqlModule, { where: { name: dep } })),
      );
      await orm.save(iasqlModule, e);

      const iasqlTables = AllModules?.iasqlPlatform?.iasqlTables ?? throwError('Core IasqlModule not found');
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
    const md = (Object.values(AllModules) as ModuleInterface[]).find(
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
            logger.scope({ dbId }).error(`Error reading from cloud entity ${mapper.entity.name}`, err);
            throw err;
          }
          if (!e || (Array.isArray(e) && !e.length)) {
            logger.scope({ dbId }).warn('No cloud entity records');
          } else {
            try {
              await mapper.db.create(e, context);
            } catch (err: any) {
              logger
                .scope({ dbId })
                .error(`Error reading from cloud entity ${mapper.entity.name}`, { e, err });
              throw err;
            }
          }
        }),
        dbId,
      );
    }
    return 'Done!';
  } catch (e: any) {
    throw e;
  }
}

export async function uninstall(moduleList: string[], dbId: string, force = false, orm?: TypeormWrapper) {
  await throwIfUpgrading(dbId, force);
  // Check to make sure that all specified modules actually exist
  const version = AllModules?.iasqlPlatform?.version ?? throwError('Core IasqlPlatform not found');
  // ignore moduleList duplicates
  moduleList = [...new Set(moduleList)];
  moduleList = moduleList.map((m: string) => (/@/.test(m) ? m : `${m}@${version}`));
  const mods = moduleList.map((n: string) =>
    (Object.values(AllModules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
  ) as ModuleInterface[];
  if (mods.some((m: any) => m === undefined)) {
    throw new Error(
      `The following modules do not exist: ${moduleList
        .filter(
          (n: string) =>
            !(Object.values(AllModules) as ModuleInterface[]).find(m => `${m.name}@${m.version}` === n),
        )
        .join(', ')}`,
    );
  }
  orm = !orm ? await TypeormWrapper.createConn(dbId) : orm;
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already uninstalled and prune them from the list
  const iasqlModule = AllModules?.iasqlPlatform?.iasqlModule ?? throwError('Core IasqlModule not found');
  const iasqlTables = AllModules?.iasqlPlatform?.iasqlTables ?? throwError('Core IasqlTables not found');
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
    logger.scope({ dbId }).warn('All modules already uninstalled', { moduleList });
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
    const Module: any = Object.values(AllModules).find((m: any) => `${m.name}@${m.version}` === mod.name);
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
      const e = await orm.findOne(iasqlModule, { where: { name: `${md.name}@${md.version}` } });
      const mt =
        (await orm.find(iasqlTables, {
          where: {
            module: e.name,
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
// TODO: Revive this as a DB startup command
/* export async function upgrade(dbId: string, dbUser: string, context: Context) {
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
  await commit(dbId, false, context, true);
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
} */

export async function commit(
  dbId: string,
  dryRun: boolean,
  context: Context,
  force = false,
  ormOpt?: TypeormWrapper,
  commitMessage?: string,
) {
  const t1 = Date.now();
  logger.scope({ dbId }).debug(`Committing to ${dbId}`);
  await throwIfUpgrading(dbId, force);
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const importedModules = await getImportedModules(dbId, versionString, force);
  // We save the incoming orm from context if any and re-assign it before exiting
  const parentOrm = context?.orm;
  let orm: TypeormWrapper | null = null;
  let currentTransactionId: string | null = null;
  try {
    orm = ormOpt ? ormOpt : await TypeormWrapper.createConn(dbId);
    context.orm = orm;

    const isRunning = await isCommitRunning(orm);
    if (!force && isRunning) throw new Error('Another execution is in process. Please try again later.');

    // Get current transaction identifier
    currentTransactionId = await getCurrentTransactionId(orm);

    if (commitMessage) {
      await insertLog(orm, AuditLogChangeType.SET_COMMIT_MESSAGE, currentTransactionId, commitMessage);
    }
    const newStartCommit: IasqlAuditLog = await insertLog(
      orm,
      dryRun ? AuditLogChangeType.PREVIEW_START_COMMIT : AuditLogChangeType.START_COMMIT,
      currentTransactionId,
    );
    if (dryRun) context.previewStartCommit = newStartCommit;
    else context.startCommit = newStartCommit;
    const previousStartCommit = await getPreviousStartCommit(orm, newStartCommit.ts);

    const changesToCommit = await getChangesToCommit(orm, newStartCommit, previousStartCommit);
    // update changes to commit with the new transaction id
    await associateTransaction(orm, changesToCommit, currentTransactionId);
    const tablesWithChanges = [...new Set(changesToCommit.map(c => c.tableName))];

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

    const modulesWithChangesSorted: ModuleInterface[] = sortModules(
      modulesWithChanges,
      installedModulesNames,
    );
    const installedModulesSorted: ModuleInterface[] = sortModules(installedModules, installedModulesNames);

    const t2 = Date.now();
    logger.scope({ dbId }).debug(`Setup took ${t2 - t1}ms`);

    const crupdes: CrupdeOperations = {
      toCreate: {},
      toUpdate: {},
      toReplace: {},
      toDelete: {},
    };
    let applyErr;
    try {
      if (modulesWithChanges.length) {
        logger.scope({ dbId }).debug('Starting apply phase for modules with changes');
        const applyRes = await apply(
          dbId,
          modulesWithChangesSorted,
          context,
          force,
          crupdes,
          dryRun,
          changesToCommit,
        );
        if (dryRun) return applyRes;
      }
    } catch (e) {
      logger.scope({ dbId, e }).warn(`Something failed applying for modules with changes.`);
      applyErr = e;
    }
    if (applyErr) {
      try {
        logger.scope({ dbId }).debug(`Starting apply phase for all modules`);
        await apply(dbId, installedModulesSorted, context, force, crupdes, dryRun);
        applyErr = null;
      } catch (e: any) {
        logger.scope({ dbId }).warn(`Something failed applying for all modules.\n${e}`);
        applyErr = e;
      }
    }
    let revertErr;
    if (applyErr) {
      try {
        await revert(dbId, context, installedModulesSorted, crupdes, currentTransactionId);
      } catch (e) {
        revertErr = e;
      }
    }
    let syncRes, syncErr;
    try {
      logger.scope({ dbId }).debug('Starting sync phase for all modules');
      syncRes = await sync(dbId, installedModulesSorted, context, force, crupdes, dryRun);
    } catch (e) {
      logger.scope({ dbId }).warn(`Something failed during sync phase for all modules\n${e}`);
      syncErr = e;
    }
    if (syncErr || revertErr || applyErr) {
      const errMessage = mergeErrorMessages([syncErr, revertErr, applyErr]);
      const err: any | Error =
        syncErr ?? revertErr ?? applyErr ?? new Error(`Something went wrong. ${errMessage}`);
      err.message = errMessage;
      throw err;
    }
    return syncRes;
  } catch (e: any) {
    debugObj(e);
    await insertErrorLog(orm, logErrSentry(e), currentTransactionId);
    throw e;
  } finally {
    // Add transaction id to all audit log records inserted by iasql
    await updateIasqlRecordsSince(
      dryRun ? AuditLogChangeType.PREVIEW_START_COMMIT : AuditLogChangeType.START_COMMIT,
      orm,
      currentTransactionId,
    );
    // Create end commit object
    await insertLog(
      orm,
      dryRun ? AuditLogChangeType.PREVIEW_END_COMMIT : AuditLogChangeType.END_COMMIT,
      currentTransactionId,
    );
    // do not drop the conn if it was provided
    if (orm !== ormOpt) orm?.dropConn();
    if (parentOrm) context.orm = parentOrm;
  }
}

async function revert(
  dbId: string,
  ctx: Context,
  installedModules: ModuleInterface[],
  crupdes: CrupdeOperations,
  currentTransactionId: string,
) {
  await insertLog(ctx.orm, AuditLogChangeType.START_REVERT, currentTransactionId);
  try {
    const changeLogsSinceLastBegin: IasqlAuditLog[] = await getChangeLogsSinceLastBegin(ctx.orm);
    const modsIndexedByTable = indexModsByTable(installedModules);
    const inverseQueries: string[] = await recreateQueries(
      changeLogsSinceLastBegin,
      modsIndexedByTable,
      ctx.orm,
      true,
    );
    await applyInverseQueries(inverseQueries, dbId, ctx, installedModules, crupdes);
  } catch (e) {
    throw e;
  } finally {
    // Update iasql audit log records with the current transaction id
    await updateIasqlRecordsSince(AuditLogChangeType.START_REVERT, ctx.orm, currentTransactionId);
    await insertLog(ctx.orm, AuditLogChangeType.END_REVERT, currentTransactionId);
  }
}

async function getChangeLogsSinceLastBegin(orm: TypeormWrapper): Promise<IasqlAuditLog[]> {
  const transaction: IasqlAuditLog = await orm.findOne(IasqlAuditLog, {
    order: { ts: 'DESC' },
    where: {
      changeType: AuditLogChangeType.OPEN_TRANSACTION,
    },
  });
  if (!transaction) throw new Error('No open transaction');
  return await orm.find(IasqlAuditLog, {
    order: { ts: 'DESC', id: 'DESC' },
    where: {
      changeType: In([AuditLogChangeType.INSERT, AuditLogChangeType.UPDATE, AuditLogChangeType.DELETE]),
      ts: MoreThan(transaction.ts),
    },
  });
}

/**
 * @internal
 * Generate SQL statements based on change logs
 */
export async function recreateQueries(
  changeLogs: IasqlAuditLog[],
  modsIndexedByTable: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
  inverse = false,
  withRelationSubQueries = false,
): Promise<string[]> {
  const queries: string[] = [];

  // Fill entity mapper object
  const entityMapper: { [key: string]: MapperBase<any> } = {};
  const tableToEntityMetadataMapper: { [tableName: string]: EntityMetadata } = {};
  for (const cl of changeLogs) {
    const mod = modsIndexedByTable[cl.tableName];
    const mappers = Object.values(mod).filter(val => val instanceof MapperBase);
    mappers.forEach(m => (entityMapper[m.entity.name] = m));
    for (const entityName of Object.keys(entityMapper)) {
      const entity = entityMapper[entityName].entity;
      const entityMetadata = await orm.getEntityMetadata(entity);
      // following the one table per mapper logic this should be true
      tableToEntityMetadataMapper[cl.tableName] = entityMetadata;
    }
  }
  // Recreate entities from change logs
  const recreatedEntitiesFromChangelogs: any[] = [];
  for (const cl of changeLogs) {
    recreatedEntitiesFromChangelogs.push(
      await recreateEntity(
        !!cl.change?.change ? cl.change.change : cl.change.original,
        tableToEntityMetadataMapper[cl.tableName],
        orm,
      ),
    );
  }
  for (const cl of changeLogs) {
    let query: string = '';
    switch (cl.changeType) {
      case AuditLogChangeType.INSERT: {
        // Augment entries
        const augmentedEntries = await Promise.all(
          Object.entries(cl.change.change ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(async ([k, v]: [string, any]) => {
              return await augmentValue(
                cl.tableName,
                k,
                v,
                modsIndexedByTable,
                orm,
                withRelationSubQueries,
                recreatedEntitiesFromChangelogs,
              );
            }),
        );
        // Get formatted query
        query = await getFormattedQuery(cl.tableName, cl.changeType, inverse, augmentedEntries);
        break;
      }
      case AuditLogChangeType.DELETE: {
        // Augment entries
        const augmentedEntries = await Promise.all(
          Object.entries(cl.change.original ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(async ([k, v]: [string, any]) => {
              return await augmentValue(
                cl.tableName,
                k,
                v,
                modsIndexedByTable,
                orm,
                withRelationSubQueries,
                recreatedEntitiesFromChangelogs,
              );
            }),
        );
        // Get formatted query
        query = await getFormattedQuery(cl.tableName, cl.changeType, inverse, augmentedEntries);
        break;
      }
      case AuditLogChangeType.UPDATE: {
        // Augment entries
        const augmentedOriginalEntries = await Promise.all(
          Object.entries(cl.change.original ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(async ([k, v]: [string, any]) => {
              return await augmentValue(
                cl.tableName,
                k,
                v,
                modsIndexedByTable,
                orm,
                withRelationSubQueries,
                recreatedEntitiesFromChangelogs,
              );
            }),
        );
        const augmentedChangedEntries = await Promise.all(
          Object.entries(cl.change.change ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(async ([k, v]: [string, any]) => {
              return await augmentValue(
                cl.tableName,
                k,
                v,
                modsIndexedByTable,
                orm,
                withRelationSubQueries,
                recreatedEntitiesFromChangelogs,
              );
            }),
        );
        // Get formatted query
        query = await getFormattedQuery(
          cl.tableName,
          cl.changeType,
          inverse,
          augmentedOriginalEntries,
          augmentedChangedEntries,
        );
        break;
      }
      default:
        break;
    }
    if (query) queries.push(query);
  }
  return queries;
}

async function getFormattedQuery(
  tableName: string,
  type: AuditLogChangeType,
  inverse: boolean,
  firstEntries: AugmentedValue[],
  secondEntries?: AugmentedValue[],
): Promise<string> {
  let query = '';
  // Ignore primary keys and autogenerated fields
  const firstValues = firstEntries.filter(e => (!e.isPrimary && !e.isAutogenerated) || !e.isAutogenerated);
  const secondValues = secondEntries?.filter(e => (!e.isPrimary && !e.isAutogenerated) || !e.isAutogenerated);
  // if type is insert or delete and inverse is true, swap types
  if (inverse && (type === AuditLogChangeType.INSERT || type === AuditLogChangeType.DELETE)) {
    type = type === AuditLogChangeType.INSERT ? AuditLogChangeType.DELETE : AuditLogChangeType.INSERT;
  }
  switch (type) {
    case AuditLogChangeType.INSERT: {
      query = format(
        `
          INSERT INTO %I (${firstValues.map(_ => '%I').join(', ')})
          VALUES (${firstValues.map(_ => '%s').join(', ')});
        `,
        tableName,
        ...firstValues.map(e => e.key),
        ...firstValues.map(e =>
          e.isJson && Array.isArray(e.value) ? `${formatValue(e)}::jsonb` : formatValue(e),
        ),
      );
      break;
    }
    case AuditLogChangeType.DELETE: {
      query = format(
        `
          DELETE FROM %I
          WHERE ${firstValues
            // We need to add an special case for AMIs since we know the revolve string can be used and it will not match with the actual AMI assigned
            .filter(e => e.key !== 'ami')
            .map(e => `${formatValue(e) === 'NULL' ? '%I IS %s' : e.isJson ? '%I::jsonb = %s' : '%I = %s'}`)
            .join(' AND ')};
        `,
        tableName,
        ...firstValues
          // We need to add an special case for AMIs since we know the revolve string can be used and it will not match with the actual AMI assigned
          .filter(e => e.key !== 'ami')
          .flatMap(e => {
            if (e.isJson && !Array.isArray(e.value)) {
              // regex to match ::json, ::jsonb or ::simple-json
              const jsonRegex = /::json(?:b)?|::simple-json/g;
              return [e.key, formatValue(e).replace(jsonRegex, '::jsonb')];
            } else if (e.isJson && Array.isArray(e.value)) {
              return [e.key, `${formatValue(e)}::jsonb`];
            }
            return [e.key, formatValue(e)];
          }),
      );
      break;
    }

    case AuditLogChangeType.UPDATE: {
      const originalValues = inverse ? secondValues : firstValues;
      const updatedValues = inverse ? firstValues : secondValues;
      query = format(
        `
        UPDATE %I
        SET ${updatedValues?.map(_ => `%I = %s`).join(', ')}
        WHERE ${originalValues
          // We need to add an special case for AMIs since we know the revolve string can be used and it will not match with the actual AMI assigned
          ?.filter(e => e.key !== 'ami')
          ?.map(e => `${formatValue(e) === 'NULL' ? '%I IS %s' : e.isJson ? '%I::jsonb = %s' : '%I = %s'}`)
          .join(' AND ')};
      `,
        tableName,
        ...(updatedValues?.flatMap(e =>
          e.isJson && Array.isArray(e.value) ? [e.key, `${formatValue(e)}::jsonb`] : [e.key, formatValue(e)],
        ) ?? []),
        ...(originalValues
          // We need to add an special case for AMIs since we know the revolve string can be used and it will not match with the actual AMI assigned
          ?.filter(e => e.key !== 'ami')
          ?.flatMap(e => {
            if (e.isJson && !Array.isArray(e.value)) {
              // regex to match ::json, ::jsonb or ::simple-json
              const jsonRegex = /::json(?:b)?|::simple-json/g;
              return [e.key, formatValue(e).replace(jsonRegex, '::jsonb')];
            } else if (e.isJson && Array.isArray(e.value)) {
              return [e.key, `${formatValue(e)}::jsonb`];
            }
            return [e.key, formatValue(e)];
          }) ?? []),
      );
      break;
    }

    default:
      break;
  }
  return query;
}

/**
 * @internal
 * Returns Typeorm metadata related to `tableName`
 */
async function getTableMetadata(
  tableName: string,
  modsIndexedByTable: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<EntityMetadata | RelationMetadata | undefined> {
  const mappers = Object.values(modsIndexedByTable[tableName] ?? {}).filter(val => val instanceof MapperBase);
  let metadata: EntityMetadata | RelationMetadata | undefined;
  for (const m of mappers) {
    const tableEntity = (m as MapperBase<any>).entity;
    const entityMetadata = await orm.getEntityMetadata(tableEntity);
    if (entityMetadata.tableName === tableName) {
      metadata = entityMetadata;
      break;
    } else {
      if (
        entityMetadata.ownRelations
          .filter(or => !!or.joinTableName)
          .map(or => or.joinTableName)
          .includes(tableName)
      ) {
        metadata = entityMetadata.ownRelations.find(or => or.joinTableName === tableName);
        break;
      }
    }
  }
  // If no metadata found, we need to do a second pass over the mappers because it could be the case of an
  // Entity that does not have it's own mapper but it is managed by another Entity Mapper.
  if (!metadata) {
    for (const m of mappers) {
      const tableEntity = (m as MapperBase<any>).entity;
      const entityMetadata = await orm.getEntityMetadata(tableEntity);
      if (
        entityMetadata.ownRelations
          .filter(or => !!or.inverseEntityMetadata.tableName)
          .map(or => or.inverseEntityMetadata.tableName)
          .includes(tableName)
      ) {
        metadata = entityMetadata.ownRelations.find(
          or => or.inverseEntityMetadata.tableName === tableName,
        )?.inverseEntityMetadata;
        break;
      }
    }
  }
  return metadata;
}

interface AugmentedValue {
  isPrimary: boolean;
  isAutogenerated: boolean;
  key: string;
  value: string;
  isJson: boolean;
  isSubQuery: boolean;
  type?: string;
  isArray: boolean;
}

/**
 * @internal
 * Return object with formatted value for query and some relevant metadata
 */
async function augmentValue(
  tableName: string,
  key: string, // database column name in snake_case
  value: any,
  modsIndexedByTable: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
  withRelationSubQueries: boolean,
  recreatedEntities?: any[],
): Promise<AugmentedValue> {
  const augmentedValue: AugmentedValue = {
    isPrimary: false,
    isAutogenerated: false,
    key,
    value,
    isJson: false,
    isSubQuery: false,
    isArray: false,
  };
  // We might need to recreate a sub-query because it could be column referencing other table.
  // For this we need to get Typeorm metadata for the `tableName` and inspect the columns and relations in order to recreate the sub-query if necessary.
  // We need to recreate the sub-query because related columns might not be the same across databases connected to the same cloud account.
  const metadata = await getTableMetadata(tableName, modsIndexedByTable, orm);
  let columnMetadata: ColumnMetadata | undefined;
  if (value && metadata) {
    // If `metadata instanceof EntityMetadata` means that the `key` is one of the Entity's properties
    if (metadata instanceof EntityMetadata) {
      columnMetadata = metadata.ownColumns.filter(oc => oc.databaseName === key)?.pop();
      if (withRelationSubQueries && !!columnMetadata?.relationMetadata) {
        augmentedValue.isSubQuery = true;
        augmentedValue.value = await recreateSubQuery(
          columnMetadata.referencedColumn?.databaseName ?? 'unknown_key',
          columnMetadata.referencedColumn?.propertyName ?? 'unknownKey',
          value,
          columnMetadata.relationMetadata?.inverseEntityMetadata,
          modsIndexedByTable,
          orm,
          withRelationSubQueries,
          recreatedEntities,
        );
      }
    }
    // If `metadata instanceof RelationMetadata` means that there's no Entity in Typeorm which it's table name is `tableName`,
    // but theres a join table linking entities and `tableName` is that join table. In this case we need to check `joinColumns`
    // which will have the columns from the owner of the relationship and `inverseJoinColumns` will have the columns coming from
    // the other entities in the relationship.
    if (metadata instanceof RelationMetadata) {
      columnMetadata = metadata.joinColumns.filter(jc => jc.databaseName === key)?.pop();
      if (withRelationSubQueries && !!columnMetadata?.relationMetadata) {
        augmentedValue.isSubQuery = true;
        augmentedValue.value = await recreateSubQuery(
          columnMetadata.referencedColumn?.databaseName ?? 'unknown_key',
          columnMetadata.referencedColumn?.propertyName ?? 'unknownKey',
          value,
          columnMetadata.relationMetadata?.entityMetadata,
          modsIndexedByTable,
          orm,
          withRelationSubQueries,
          recreatedEntities,
        );
      }
      columnMetadata = metadata.inverseJoinColumns.filter(jc => jc.databaseName === key)?.pop();
      if (withRelationSubQueries && !!columnMetadata?.relationMetadata) {
        augmentedValue.isSubQuery = true;
        augmentedValue.value = await recreateSubQuery(
          columnMetadata.referencedColumn?.databaseName ?? 'unknown_key',
          columnMetadata.referencedColumn?.propertyName ?? 'unknownKey',
          value,
          columnMetadata.relationMetadata?.inverseEntityMetadata,
          modsIndexedByTable,
          orm,
          withRelationSubQueries,
          recreatedEntities,
        );
      }
    }
  }
  if (
    columnMetadata &&
    typeof columnMetadata.type === 'string' &&
    ['simple-json', 'json', 'jsonb'].includes(columnMetadata.type)
  ) {
    augmentedValue.isJson = true;
  } else if (columnMetadata && columnMetadata.isArray) {
    augmentedValue.isArray = true;
  }

  if (columnMetadata && typeof columnMetadata.type === 'string') {
    augmentedValue.type = columnMetadata.type;
  }

  augmentedValue.isPrimary = columnMetadata?.isPrimary ?? false;
  augmentedValue.isAutogenerated = columnMetadata?.isGenerated ?? false;
  return augmentedValue;
}

function formatValue(augmentedValue: AugmentedValue): string {
  if (augmentedValue.isSubQuery) return augmentedValue.value;
  if (augmentedValue.isArray) {
    return augmentedValue.type
      ? format('array[%L]::%I[]', augmentedValue.value, augmentedValue.type)
      : format('array[%L]', augmentedValue.value);
  }
  if (augmentedValue.isJson && Array.isArray(augmentedValue.value)) {
    return format('%L', JSON.stringify(augmentedValue.value));
  }
  return format('%L', augmentedValue.value);
}

/**
 * @internal
 * Returns sub-query based on the referenced column in the relation.
 * The related entity will be found using the cloud columns decorators.
 */
async function recreateSubQuery(
  referencedDbKey: string,
  referencedKey: string,
  value: any,
  entityMetadata: EntityMetadata | undefined,
  modsIndexedByTable: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
  withRelationSubQueries: boolean,
  recreatedEntities?: any[],
): Promise<string> {
  // Get cloud columns of the entity we want to look for.
  const cloudIds = getCloudId(entityMetadata?.target);
  let cloudColumns: { dbName: string; propertyName: string }[] = [];
  if (cloudIds && !(cloudIds instanceof Error)) {
    cloudColumns = cloudIds.map(cid => ({ dbName: snakeCase(cid), propertyName: cid }));
    let e: any;
    try {
      e = await orm.findOne(entityMetadata?.targetName ?? '', { where: { [referencedKey]: value } });
    } catch (e: any) {
      logger.warn(e.message ?? 'Error finding relation');
      e = null;
    }
    // Entity might have been deleted. Let's try to look for in the recreated entities.
    if (e === null) {
      e = recreatedEntities?.find(re => re[referencedKey] === value);
      if (!e) return '<relation_not_found>';
    }
    let values = await Promise.all(
      cloudColumns.map(
        async cc =>
          await augmentValue(
            entityMetadata?.tableName ?? 'unknown_table',
            cc.dbName,
            e?.[cc.propertyName],
            modsIndexedByTable,
            orm,
            withRelationSubQueries,
            recreatedEntities,
          ),
      ),
    );
    // If all cloud column values are null is quite useless to do the query, then we fall back to all db columns with values
    // since they will help to identify the record.
    let dbColumns: { dbName: string; propertyName: string }[] = [];
    if (values.every(v => formatValue(v) === 'NULL')) {
      dbColumns =
        entityMetadata?.ownColumns
          .filter(oc => !oc.relationMetadata && !!e[oc.propertyName] && !oc.isPrimary)
          .map(oc => ({ dbName: oc.databaseName, propertyName: oc.propertyName })) ?? [];
      values = await Promise.all(
        dbColumns.map(
          async dbc =>
            await augmentValue(
              entityMetadata?.tableName ?? 'unknown_table',
              dbc.dbName,
              e?.[dbc.propertyName],
              modsIndexedByTable,
              orm,
              withRelationSubQueries,
              recreatedEntities,
            ),
        ),
      );
    }
    const subQuery = format(
      `SELECT %I FROM %I WHERE ${values
        ?.filter(v => v.key !== 'ami')
        ?.map(v => `${formatValue(v) === 'NULL' ? '%I IS %s' : v.isJson ? '%I::jsonb = %s' : '%I = %s'}`)
        .join(' AND ')}`,
      referencedDbKey,
      entityMetadata?.tableName,
      ...values.flatMap(v => [v.key, formatValue(v)]),
    );
    return `(${subQuery})`;
  }
  return '';
}

/**
 * @internal
 * Executes all the queries received one by one and the call `apply`
 */
async function applyInverseQueries(
  inverseQueries: string[],
  dbId: string,
  ctx: Context,
  installedModules: ModuleInterface[],
  crupdes: CrupdeOperations,
) {
  try {
    for (const q of inverseQueries) {
      try {
        await ctx.orm.query(q);
      } catch (e) {
        logger.scope({ dbId }).warn(`Error applying inverse query: ${JSON.stringify(e)}`);
      }
    }
    await apply(dbId, installedModules, ctx, true, crupdes, false);
  } catch (e) {
    throw e;
  }
}

export async function rollback(dbId: string, context: Context, force = false, ormOpt?: TypeormWrapper) {
  const t1 = Date.now();
  logger.scope({ dbId }).debug(`Sync to ${dbId}`);
  await throwIfUpgrading(dbId, force);
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const importedModules = await getImportedModules(dbId, versionString, force);
  // We save the incoming orm from context if any and re-assign it before exiting
  const parentOrm = context?.orm;
  let orm: TypeormWrapper | null = null;
  let currentTransactionId: string | null = null;
  try {
    orm = ormOpt ? ormOpt : await TypeormWrapper.createConn(dbId);
    context.orm = orm;

    const isRunning = await isCommitRunning(orm);
    if (!force && isRunning) throw new Error('Another execution is in process. Please try again later.');

    // Get current transaction identifier
    currentTransactionId = await getCurrentTransactionId(orm);

    const newStartCommit = await insertLog(orm, AuditLogChangeType.START_COMMIT, currentTransactionId);
    context.startCommit = newStartCommit;
    const previousStartCommit = await getPreviousStartCommit(orm, newStartCommit.ts);

    const changes = await getChangesToCommit(orm, newStartCommit, previousStartCommit);
    // update changes to commit with the new transaction id
    await associateTransaction(orm, changes, currentTransactionId);

    const installedModulesNames = (await orm.find(IasqlModule)).map((m: any) => m.name);
    const installedModules: ModuleInterface[] = (Object.values(importedModules) as ModuleInterface[]).filter(
      mod => installedModulesNames.includes(`${mod.name}@${mod.version}`),
    );
    const installedModulesSorted: ModuleInterface[] = sortModules(installedModules, installedModulesNames);

    const t2 = Date.now();
    logger.scope({ dbId }).debug(`Setup took ${t2 - t1}ms`);

    const crupdes: CrupdeOperations = {
      toCreate: {},
      toUpdate: {},
      toReplace: {},
      toDelete: {},
    };
    return await sync(dbId, installedModulesSorted, context, force, crupdes, false);
  } catch (e: any) {
    debugObj(e);
    await insertErrorLog(orm, logErrSentry(e), currentTransactionId);
    throw e;
  } finally {
    // Add transaction id to all audit log records inserted by iasql
    await updateIasqlRecordsSince(AuditLogChangeType.START_COMMIT, orm, currentTransactionId);
    // Create end commit object
    await insertLog(orm, AuditLogChangeType.END_COMMIT, currentTransactionId);
    // do not drop the conn if it was provided
    if (orm !== ormOpt) orm?.dropConn();
    if (parentOrm) context.orm = parentOrm;
  }
}

async function throwIfUpgrading(dbId: string, force: boolean) {
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (!force && dbMeta?.upgrading) throw new Error('The database is upgrading. Please try again later.');
}

async function getImportedModules(dbId: string, versionString: string, force: boolean) {
  if (versionString !== config.version)
    throw new Error(`Unsupported version ${versionString}. Please upgrade or replace this database.`);
  const dbMeta = await MetadataRepo.getDbById(dbId);
  if (!force && dbMeta?.upgrading) throw new Error('Cannot apply a change while upgrading');
  return AllModules;
}

export async function isCommitRunning(orm: TypeormWrapper): Promise<boolean> {
  const logs: IasqlAuditLog[] = await orm.find(IasqlAuditLog, {
    order: { ts: 'DESC' },
    where: {
      changeType: In([
        AuditLogChangeType.START_COMMIT,
        AuditLogChangeType.PREVIEW_START_COMMIT,
        AuditLogChangeType.END_COMMIT,
        AuditLogChangeType.PREVIEW_END_COMMIT,
      ]),
      user: Not(config.db.user),
    },
    take: 1,
  });
  return [AuditLogChangeType.START_COMMIT, AuditLogChangeType.PREVIEW_START_COMMIT].includes(
    logs[0]?.changeType,
  );
}

async function insertLog(
  orm: TypeormWrapper | null,
  changeType: AuditLogChangeType,
  transactionId: string | null = null,
  message: string | null = null,
): Promise<IasqlAuditLog> {
  const commitLog = new IasqlAuditLog();
  commitLog.user = config.db.user;
  commitLog.change = {};
  commitLog.changeType = changeType;
  commitLog.tableName = 'iasql_audit_log';
  commitLog.ts = new Date();
  if (transactionId) commitLog.transactionId = transactionId;
  if (message) commitLog.message = message;
  await orm?.save(IasqlAuditLog, commitLog);
  return commitLog;
}

async function getPreviousStartCommit(orm: TypeormWrapper, currentTs: Date): Promise<IasqlAuditLog | null> {
  // Find 'START_COMMIT's and pick the first element since it should be the previous one to the ts we have just inserted
  const startCommits: IasqlAuditLog[] = await orm.find(IasqlAuditLog, {
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

function getChangesToCommit(
  orm: TypeormWrapper,
  newStartCommit: IasqlAuditLog,
  previousStartCommit: IasqlAuditLog | null,
): Promise<IasqlAuditLog[]> {
  return orm.find(IasqlAuditLog, {
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

async function apply(
  dbId: string,
  relevantModules: ModuleInterface[],
  context: Context,
  force: boolean,
  crupdes: CrupdeOperations,
  dryRun: boolean,
  changesToCommit?: IasqlAuditLog[],
): Promise<{ iasqlPlanVersion: number; rows: any[] }> {
  const oldOrm = context.orm;
  context.orm = await TypeormWrapper.createConn(dbId);
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
  let recordsApplied = 0;
  const { toCreate, toUpdate, toReplace, toDelete } = crupdes;
  do {
    const t2 = Date.now();
    logger.scope({ dbId }).debug('Starting outer loop');
    ranFullUpdate = false;
    const tables = mappers.map(mapper => mapper.entity.name);
    context.memo.db = {}; // Flush the DB entities on the outer loop to restore the actual intended state
    await lazyLoader(
      mappers.map(mapper => async () => {
        await mapper.db.read(context);
      }),
      dbId,
    );
    // Every time we read from db we get possible changes that occurred after this commit started
    const changesAfterCommitByEntity = await getChangesAfterCommitStartedByEntity(
      context.orm,
      context,
      dbId,
      force,
    );
    const comparators = mappers.map(mapper => mapper.equals);
    const idGens = mappers.map(mapper => mapper.entityId);
    let ranUpdate = false;
    do {
      logger.scope({ dbId }).debug('Starting inner loop');
      ranUpdate = false;
      context.memo.cloud = {}; // Flush the Cloud entities on the inner loop to track changes to the state
      await lazyLoader(
        mappers.map(mapper => async () => {
          await mapper.cloud.read(context);
        }),
        dbId,
      );
      const t3 = Date.now();
      logger.scope({ dbId }).debug(`Record acquisition time: ${t3 - t2}ms`);
      const records = colToRow({
        table: tables,
        mapper: mappers,
        dbEntity: tables.map(t => (context.memo.db[t] ? Object.values(context.memo.db[t]) : [])),
        cloudEntity: tables.map(t => (context.memo.cloud[t] ? Object.values(context.memo.cloud[t]) : [])),
        comparator: comparators,
        idGen: idGens,
      });
      const t4 = Date.now();
      logger.scope({ dbId }).debug(`AWS Mapping time: ${t4 - t3}ms`);
      if (!records.length) {
        await context.orm.dropConn();
        context.orm = oldOrm;
        // Only possible on just-created databases
        return {
          iasqlPlanVersion: 3,
          rows: [],
        };
      }

      let changesByEntity: { [key: string]: any[] };
      if (changesToCommit?.length) {
        const modsIndexedByTable = indexModsByTable(relevantModules);
        changesByEntity = await getChangesByEntity(context.orm, changesToCommit, modsIndexedByTable);
      }

      records.forEach(r => {
        r.diff = findDiff(r.dbEntity, r.cloudEntity, r.idGen, r.comparator);
        // If we have changes done by the user to be applied, then filter them.
        // Else, only filter changes done after this commit started to avoid overrides.
        if (changesByEntity) {
          r.diff.entitiesInDbOnly = r.diff.entitiesInDbOnly.filter((e: any) =>
            changesByEntity[r.table]?.find(re => r.idGen(e) === r.idGen(re)),
          );
          r.diff.entitiesInAwsOnly = r.diff.entitiesInAwsOnly.filter((e: any) =>
            changesByEntity[r.table]?.find(re => r.idGen(e) === r.idGen(re)),
          );
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
          updateCommitPlan(toCreate, r.table, r.mapper, r.diff.entitiesInDbOnly);
        }
        if (r.diff.entitiesInAwsOnly.length > 0) {
          updateCommitPlan(toDelete, r.table, r.mapper, r.diff.entitiesInAwsOnly);
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
          if (updates.length > 0) updateCommitPlan(toUpdate, r.table, r.mapper, updates);
          if (replaces.length > 0) updateCommitPlan(toReplace, r.table, r.mapper, replaces);
        }
      });
      if (dryRun) {
        await context.orm.dropConn();
        context.orm = oldOrm;
        return iasqlPlanV3(toCreate, toUpdate, toReplace, toDelete);
      }
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
      logger.scope({ dbId }).debug(`Diff time: ${t5 - t4}ms`);
      const promiseGenerators = records
        .map(r => {
          const name = r.table;
          logger.scope({ dbId }).debug(`Checking ${name}`);
          const outArr = [];
          recordsApplied += r.diff.entitiesInDbOnly.length;
          if (r.diff.entitiesInDbOnly.length > 0) {
            logger
              .scope({ dbId })
              .debug(`${name} has records to create - apply`, { records: r.diff.entitiesInDbOnly });
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
          recordsApplied += r.diff.entitiesChanged.length;
          if (r.diff.entitiesChanged.length > 0) {
            logger
              .scope({ dbId })
              .debug(`${name} has records to update - apply`, { records: r.diff.entitiesChanged });
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
          logger.scope({ dbId }).debug(`Checking ${name}`);
          const outArr = [];
          recordsApplied += r.diff.entitiesInAwsOnly.length;
          if (r.diff.entitiesInAwsOnly.length > 0) {
            logger
              .scope({ dbId })
              .debug(`${name} has records to delete - apply`, { records: r.diff.entitiesInAwsOnly });
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
          await lazyLoader(generators, dbId);
        } catch (e: any) {
          if (failureCount === e.metadata?.generatorsToRun?.length) throw e;
          failureCount = e.metadata?.generatorsToRun?.length;
          ranUpdate = false;
        }
        const t6 = Date.now();
        logger.scope({ dbId }).debug(`AWS update time: ${t6 - t5}ms`);
      }
    } while (ranUpdate);
  } while (ranFullUpdate);
  const t7 = Date.now();
  logger.scope({ dbId }).debug(`${dbId} applied and synced, total time: ${t7 - t1}ms`);
  const output = iasqlPlanV3(toCreate, toUpdate, toReplace, toDelete);
  if (recordsApplied > 0) {
    (async () => {
      const totalRecordsApplied = await MetadataRepo.incrementRecordsApplied(dbId, recordsApplied);
      if (totalRecordsApplied) {
        const user = await MetadataRepo.getUserFromDbId(dbId);
        if (user) {
          telemetry.logCommitApply(
            user?.id,
            {
              recordsApplied: totalRecordsApplied,
              dbId,
            },
            {
              output: output.rows.toString(),
            },
          );
        }
      }
    })();
  }
  await context.orm.dropConn();
  context.orm = oldOrm;
  return output;
}

async function sync(
  dbId: string,
  relevantModules: ModuleInterface[],
  context: Context,
  force: boolean,
  crupdes: CrupdeOperations,
  dryRun: boolean,
): Promise<{ iasqlPlanVersion: number; rows: any[] }> {
  const oldOrm = context.orm;
  context.orm = await TypeormWrapper.createConn(dbId);
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
  let recordsSynced = 0;
  const { toCreate, toUpdate, toReplace, toDelete } = crupdes;
  do {
    const t2 = Date.now();
    ranFullUpdate = false;
    const tables = mappers.map(mapper => mapper.entity.name);
    context.memo.cloud = {}; // Flush the cloud entities on the outer loop to restore the actual intended state
    await lazyLoader(
      mappers.map(mapper => async () => {
        await mapper.cloud.read(context);
      }),
      dbId,
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
        dbId,
      );
      // Every time we read from db we get possible changes that occurred after this commit started
      const changesAfterCommitByEntity = await getChangesAfterCommitStartedByEntity(
        context.orm,
        context,
        dbId,
        force,
      );
      const t3 = Date.now();
      logger.scope({ dbId }).debug(`Record acquisition time: ${t3 - t2}ms`);
      const records = colToRow({
        table: tables,
        mapper: mappers,
        dbEntity: tables.map(t => (context.memo.db[t] ? Object.values(context.memo.db[t]) : [])),
        cloudEntity: tables.map(t => (context.memo.cloud[t] ? Object.values(context.memo.cloud[t]) : [])),
        comparator: comparators,
        idGen: idGens,
      });
      const t4 = Date.now();
      logger.scope({ dbId }).debug(`AWS Mapping time: ${t4 - t3}ms`);
      if (!records.length) {
        await context.orm.dropConn();
        context.orm = oldOrm;
        // Only possible on just-created databases
        return {
          iasqlPlanVersion: 3,
          rows: [],
        };
      }
      records.forEach(r => {
        r.diff = findDiff(r.dbEntity, r.cloudEntity, r.idGen, r.comparator);
        // Only filter changes done after this commit started to avoid overrides.
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
          updateCommitPlan(toDelete, r.table, r.mapper, r.diff.entitiesInDbOnly);
        }
        if (r.diff.entitiesInAwsOnly.length > 0) {
          updateCommitPlan(toCreate, r.table, r.mapper, r.diff.entitiesInAwsOnly);
        }
        if (r.diff.entitiesChanged.length > 0) {
          const updates: any[] = [];
          r.diff.entitiesChanged.forEach((e: any) => {
            updates.push(e.cloud);
          });
          if (updates.length > 0) updateCommitPlan(toUpdate, r.table, r.mapper, updates);
        }
      });
      if (dryRun) {
        await context.orm.dropConn();
        context.orm = oldOrm;
        return iasqlPlanV3(toCreate, toUpdate, toReplace, toDelete);
      }
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
      logger.scope({ dbId }).debug(`Diff time: ${t5 - t4}ms`);
      const promiseGenerators = records
        .map(r => {
          const name = r.table;
          logger.scope({ dbId }).debug(`Checking ${name}`);
          const outArr = [];
          recordsSynced += r.diff.entitiesInAwsOnly.length;
          if (r.diff.entitiesInAwsOnly.length > 0) {
            logger
              .scope({ dbId })
              .debug(`${name} has records to create - sync`, { records: r.diff.entitiesInAwsOnly });
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
          recordsSynced += r.diff.entitiesChanged.length;
          if (r.diff.entitiesChanged.length > 0) {
            logger
              .scope({ dbId })
              .debug(`${name} has records to update - sync`, { records: r.diff.entitiesChanged });
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
          logger.scope({ dbId }).debug(`Checking ${name}`);
          const outArr = [];
          recordsSynced += r.diff.entitiesInDbOnly.length;
          if (r.diff.entitiesInDbOnly.length > 0) {
            logger
              .scope({ dbId })
              .debug(`${name} has records to delete - sync`, { records: r.diff.entitiesInDbOnly });
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
          await lazyLoader(generators, dbId);
        } catch (e: any) {
          if (failureCount === e.metadata?.generatorsToRun?.length) throw e;
          failureCount = e.metadata?.generatorsToRun?.length;
          ranUpdate = false;
        }
        const t6 = Date.now();
        logger.scope({ dbId }).debug(`AWS update time: ${t6 - t5}ms`);
      }
    } while (ranUpdate);
  } while (ranFullUpdate);
  const t7 = Date.now();
  logger.scope({ dbId }).debug(`${dbId} synced, total time: ${t7 - t1}ms`);
  const output = iasqlPlanV3(toCreate, toUpdate, toReplace, toDelete);
  if (recordsSynced > 0) {
    (async () => {
      const totalRecordsSynced = await MetadataRepo.incrementRecordsSynced(dbId, recordsSynced);
      if (totalRecordsSynced) {
        const user = await MetadataRepo.getUserFromDbId(dbId);
        if (user) {
          telemetry.logCommitSync(
            user?.id,
            {
              recordsSynced: totalRecordsSynced,
            },
            {
              output: output.rows.toString(),
            },
          );
        }
      }
    })();
  }
  await context.orm.dropConn();
  context.orm = oldOrm;
  return output;
}

function updateCommitPlan(crupde: Crupde, entityName: string, mapper: MapperInterface<any>, es: any[]) {
  crupde[entityName] = crupde[entityName] ?? [];
  const rs = es.map((e: any) => ({
    id: e?.id?.toString() ?? '',
    description: mapper.entityId(e),
  }));
  rs.forEach(r => {
    if (!crupde[entityName].some(r2 => Object.is(r2.id, r.id) && Object.is(r2.description, r.description)))
      crupde[entityName].push(r);
  });
}

async function getChangesByEntity(
  orm: TypeormWrapper,
  changesToCommit: IasqlAuditLog[],
  modsIndexedByTable: { [key: string]: ModuleInterface },
): Promise<{ [key: string]: any[] }> {
  const changesByEntity: { [key: string]: any[] } = {};
  for (const c of changesToCommit) {
    const mod = modsIndexedByTable[c.tableName];
    const mappers = Object.values(mod).filter(val => val instanceof MapperBase);
    const entityMapper: { [key: string]: MapperBase<any> } = {};
    mappers.forEach(m => (entityMapper[m.entity.name] = m));
    for (const e of Object.keys(entityMapper)) {
      const entity = entityMapper[e].entity;
      const entityName = entity.name;
      const changedEntities: any[] = [];
      const metadata = await orm.getEntityMetadata(entity);
      if (metadata.tableName === c.tableName) {
        if ([AuditLogChangeType.INSERT, AuditLogChangeType.UPDATE].includes(c.changeType)) {
          // When we are inserting or updating we are sure that the value exists in the database.
          // We need to look for the primary database columns and then get the object.
          const primaryCols = metadata.primaryColumns.map(pc => pc.databaseName); // databaseName should return in snake_case
          const changedE = await orm.findOne(entity, {
            where: Object.fromEntries(
              Object.entries(c.change.change)
                .filter(([k, _]: [string, any]) => primaryCols.includes(k))
                .map(([k, v]: [string, any]) => [camelCase(k), v]),
            ),
          });
          if (changedE) changedEntities.push(changedE);
          // If it is an UPDATE case we need to save as a change the original entity in case a `cloudId` property changed.
          // We cannot query the original entity since it is not in the DB, but we can do our best recreating it.
          if (c.change.original) {
            const originalE = await recreateEntity(c.change.original, metadata, orm);
            if (originalE) changedEntities.push(originalE);
          }
        } else if (c.changeType === AuditLogChangeType.DELETE) {
          // We cannot get the exact entity because does not exists in the db anymore, but we recreate the object with the information we have
          const originalE = await recreateEntity(c.change.original, metadata, orm);
          if (originalE) changedEntities.push(originalE);
        }
      } else {
        // It might be a join table from this entity
        // we look for the relation and since it is a join table we find the primary object and push that as the change
        const joinTableCols: { [key: string]: string[][] } = {};
        metadata.ownRelations
          .filter(or => !!or.joinTableName)
          .forEach(
            or =>
              (joinTableCols[or.joinTableName] = or.joinColumns.map(jc => [
                jc.databaseName,
                jc.referencedColumn?.databaseName ?? '',
              ])),
          ); // databaseName should return in snake_case
        if (Object.keys(joinTableCols).includes(c.tableName)) {
          // Here we know for a fact that the parent entity exists, because it is not possible to be in a join table and relate to something that is not in the db.
          const changeObj = c.changeType === AuditLogChangeType.DELETE ? c.change.original : c.change.change;
          const changedE = await orm.findOne(entity, {
            where: Object.fromEntries(
              Object.entries(changeObj)
                .filter(([k, _]: [string, any]) => !!joinTableCols[c.tableName].find(jc => jc[0] === k))
                .map(([k, v]: [string, any]) => {
                  const joinColWithReference = joinTableCols[c.tableName].find(jc => jc[0] === k);
                  return [camelCase(joinColWithReference?.[1] ?? ''), v];
                }),
            ),
          });
          if (changedE) changedEntities.push(changedE);
        }
      }
      if (changedEntities.length) {
        changesByEntity[entityName] = changesByEntity[entityName] ?? [];
        changesByEntity[entityName].push(...changedEntities);
      }
    }
  }
  return changesByEntity;
}

async function recreateEntity(
  originalChange: any,
  entityMetadata: EntityMetadata,
  orm: TypeormWrapper,
): Promise<any | undefined> {
  const originalE: any = {};
  // Recreate object with original properties
  Object.entries(originalChange).forEach(([k, v]: [string, any]) => {
    const colMetadata = entityMetadata.ownColumns.find(oc => oc.databaseName === k);
    let eKey;
    if (!!colMetadata?.referencedColumn) {
      eKey = colMetadata.propertyAliasName;
    } else if (!!colMetadata) {
      eKey = colMetadata.propertyName;
    } else {
      eKey = camelCase(k);
    }
    originalE[eKey] = v;
  });
  await recreateRelation('OneToMany', originalE, entityMetadata, orm);
  await recreateRelation('ManyToOne', originalE, entityMetadata, orm);
  await recreateRelation('OneToOne', originalE, entityMetadata, orm);
  return Object.keys(originalE).length ? originalE : undefined;
}

async function recreateRelation(
  rel: 'OneToMany' | 'ManyToOne' | 'OneToOne',
  mutE: any,
  entityMetadata: EntityMetadata,
  orm: TypeormWrapper,
) {
  const isSingleResult = rel !== 'OneToMany';
  const relations = entityMetadata.ownRelations
    .filter(or => or.isEager && or[`is${rel}`])
    .map(or => ({
      targetEntity: or.inverseEntityMetadata.targetName,
      propertyName: or.propertyName,
      colsWithReferences: or.joinColumns.map(jc => [jc.propertyName, jc.referencedColumn?.propertyName]),
    }));
  for (const r of relations) {
    if (isSingleResult) {
      const relE = await orm.findOne(r.targetEntity, {
        where: Object.fromEntries(
          r.colsWithReferences.map(cwr => {
            return [cwr[1], mutE[cwr[0] ?? '']];
          }),
        ),
      });
      mutE[r.propertyName] = relE;
    } else {
      const relEs = await orm.find(r.targetEntity, {
        where: Object.fromEntries(
          r.colsWithReferences.map(cwr => {
            return [cwr[1], mutE[cwr[0] ?? '']];
          }),
        ),
      });
      mutE[r.propertyName] = relEs;
    }
  }
}

export function indexModsByTable(mods: ModuleInterface[]): { [key: string]: ModuleInterface } {
  const modsIndexedByTable: { [key: string]: ModuleInterface } = {};
  mods.forEach(mod => {
    mod.provides?.tables?.forEach((t: string) => (modsIndexedByTable[t] = mod));
  });
  return modsIndexedByTable;
}

async function getChangesAfterCommitStartedByEntity(
  orm: TypeormWrapper,
  context: Context,
  dbId: string,
  force: boolean,
): Promise<{ [key: string]: any[] }> {
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

  const versionString = await TypeormWrapper.getVersionString(dbId);
  const importedModules = await getImportedModules(dbId, versionString, force);

  const tablesWithChanges = [...new Set(changesAfterCommit.map(c => c.tableName))];

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

  const modsIndexedByTable = indexModsByTable(modulesWithChanges);

  return await getChangesByEntity(orm, changesAfterCommit, modsIndexedByTable);
}

export async function maybeOpenTransaction(orm: TypeormWrapper): Promise<void> {
  // Check for a couple of minutes if no other transaction is open and if no other commit is running
  let addedTransaction = false,
    loops = 120;
  do {
    const [isRunning, openTransaction] = await Promise.all([isCommitRunning(orm), isOpenTransaction(orm)]);
    if (!isRunning && !openTransaction) {
      const transactionId = uuidv4();
      await insertLog(orm, AuditLogChangeType.OPEN_TRANSACTION, transactionId);
      addedTransaction = true;
    } else {
      await new Promise(r => setTimeout(r, 1000)); // Sleep for a sec
      loops--;
    }
  } while (!addedTransaction && !!loops);
  if (!addedTransaction) throw new Error('Another transaction is open or running. Please try again later.');
}

export async function closeTransaction(orm: TypeormWrapper): Promise<void> {
  // Get current transaction identifier
  const currentTransactionId = await getCurrentTransactionId(orm);
  // Assign transaction id to all possible iasql created records after the transaction was opened
  await updateIasqlRecordsSince(AuditLogChangeType.OPEN_TRANSACTION, orm, currentTransactionId);
  await insertLog(orm, AuditLogChangeType.CLOSE_TRANSACTION, currentTransactionId);
}

export async function isOpenTransaction(orm: TypeormWrapper): Promise<boolean> {
  const transactions = await orm.find(IasqlAuditLog, {
    order: { ts: 'DESC' },
    where: {
      changeType: In([AuditLogChangeType.OPEN_TRANSACTION, AuditLogChangeType.CLOSE_TRANSACTION]),
    },
    take: 1,
  });
  return !!transactions?.length && transactions[0].changeType === AuditLogChangeType.OPEN_TRANSACTION;
}

export async function insertErrorLog(
  orm: TypeormWrapper | null,
  err: string,
  transactionId: string | null = null,
): Promise<void> {
  const errorLog = new IasqlAuditLog();
  errorLog.user = config.db.user;
  errorLog.change = {};
  errorLog.message = err;
  errorLog.changeType = AuditLogChangeType.ERROR;
  errorLog.tableName = 'iasql_audit_log';
  errorLog.ts = new Date();
  if (transactionId) errorLog.transactionId = transactionId;
  await orm?.save(IasqlAuditLog, errorLog);
}

/** @internal */
export async function getInstalledModules(orm: TypeormWrapper): Promise<ModuleInterface[]> {
  const installedModulesNames = (await orm.find(IasqlModule)).map((m: any) => m.name);
  return (Object.values(AllModules) as ModuleInterface[]).filter(mod =>
    installedModulesNames.includes(`${mod.name}@${mod.version}`),
  );
}

export async function getCurrentTransactionId(orm: TypeormWrapper): Promise<string> {
  const transaction: IasqlAuditLog | undefined = await orm.findOne(IasqlAuditLog, {
    order: { ts: 'DESC' },
    where: {
      changeType: AuditLogChangeType.OPEN_TRANSACTION,
    },
  });
  return transaction ? transaction.transactionId : '<no-id-found>';
}

async function associateTransaction(
  orm: TypeormWrapper | null,
  changes: IasqlAuditLog[],
  transactionId: string | null = null,
): Promise<void> {
  for (const change of changes) {
    if (transactionId) change.transactionId = transactionId;
  }
  await orm?.save(IasqlAuditLog, changes);
}

async function updateIasqlRecordsSince(
  changeType: AuditLogChangeType,
  orm: TypeormWrapper | null,
  transactionId: string | null = null,
): Promise<void> {
  // Get last `AuditLogChangeType` record
  const lastChangeTypeLog: IasqlAuditLog | undefined = await orm?.findOne(IasqlAuditLog, {
    order: { ts: 'DESC' },
    where: {
      changeType,
    },
  });
  if (!lastChangeTypeLog) return;
  // Get iasql_audit_log records since last AuditLogChangeType`
  const changes = await orm?.find(IasqlAuditLog, {
    order: { ts: 'DESC' },
    where: {
      changeType: In(['INSERT', 'UPDATE', 'DELETE']),
      transactionId: IsNull(),
      ts: MoreThan(lastChangeTypeLog.ts),
      user: config.db.user,
    },
  });
  await associateTransaction(orm, changes, transactionId);
}
