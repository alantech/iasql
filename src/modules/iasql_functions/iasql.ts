import * as levenshtein from 'fastest-levenshtein';
import { default as cloneDeep } from 'lodash.clonedeep';
import { Not, In, Between, LessThan, MoreThan, EntityMetadata } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { camelCase, snakeCase } from 'typeorm/util/StringUtils';

import config from '../../config';
import { throwError } from '../../config/config';
import * as AllModules from '../../modules';
import { Context, MapperInterface, ModuleInterface, MapperBase } from '../../modules';
import * as dbMan from '../../services/db-manager';
import { findDiff } from '../../services/diff';
import { DepError, lazyLoader } from '../../services/lazy-dep';
import logger, { debugObj, logErrSentry, mergeErrorMessages } from '../../services/logger';
import { sortModules } from '../../services/mod-sort';
import MetadataRepo from '../../services/repositories/metadata';
import * as telemetry from '../../services/telemetry';
import { TypeormWrapper } from '../../services/typeorm';
import { AuditLogChangeType, IasqlAuditLog, IasqlModule } from '../iasql_platform/entity';

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

export async function modules(all: boolean, installed: boolean, dbId: string) {
  await throwIfUpgrading(dbId, false);
  const allModules = Object.values(AllModules)
    .filter(
      (m: any) => m.hasOwnProperty('dependencies') && m.hasOwnProperty('name') && !/iasql_.*/.test(m.name),
    )
    .map((m: any) => ({
      moduleName: m.name,
      moduleVersion: m.version,
      dependencies: m.dependencies.filter((d: any) => !/iasql_.*/.test(d)),
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
  dbUser: string,
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
        md.dependencies.map(async dep => await orm.findOne(iasqlModule, { name: dep })),
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
    await orm.query(dbMan.grantPostgresGroupRoleQuery(dbUser, dbId));
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
    (async () => {
      const user = await MetadataRepo.getUserFromDbId(dbId);
      if (user && (moduleNames.length > 0 || moduleNames[0] !== 'aws_account')) {
        // ignore installing of aws_account only on connect
        telemetry.logInstall(
          user?.id,
          {
            dbId,
          },
          {
            params: moduleNames,
            output: 'Done!',
          },
        );
      }
    })();
    return 'Done!';
  } catch (e: any) {
    throw e;
  }
}

export async function uninstall(moduleList: string[], dbId: string, force = false, orm?: TypeormWrapper) {
  await throwIfUpgrading(dbId, force);
  // Check to make sure that all specified modules actually exist
  const version = AllModules?.iasqlPlatform?.version ?? throwError('Core IasqlPlatform not found');
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
  (async () => {
    const user = await MetadataRepo.getUserFromDbId(dbId);
    if (user) {
      telemetry.logUninstall(
        user?.id,
        {
          dbId,
        },
        {
          params: moduleList,
          output: 'Done!',
        },
      );
    }
  })();
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
) {
  const t1 = Date.now();
  logger.scope({ dbId }).info(`Committing to ${dbId}`);
  await throwIfUpgrading(dbId, force);
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const importedModules = await getImportedModules(dbId, versionString, force);
  // We save the incoming orm from context if any and re-assign it before exiting
  const parentOrm = context?.orm;
  let orm: TypeormWrapper | null = null;
  try {
    orm = ormOpt ? ormOpt : await TypeormWrapper.createConn(dbId);
    context.orm = orm;

    const isRunning = await isCommitRunning(orm);
    if (!force && isRunning) throw new Error('Another execution is in process. Please try again later.');

    const newStartCommit: IasqlAuditLog = await insertLog(orm, dryRun ? 'preview_start' : 'start');
    if (dryRun) context.previewStartCommit = newStartCommit;
    else context.startCommit = newStartCommit;
    const previousStartCommit = await getPreviousStartCommit(orm, newStartCommit.ts);

    const changesToCommit = await getChangesToCommit(orm, newStartCommit, previousStartCommit);
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
    logger.scope({ dbId }).info(`Setup took ${t2 - t1}ms`);

    const crupdes: { toCreate: Crupde; toUpdate: Crupde; toReplace: Crupde; toDelete: Crupde } = {
      toCreate: {},
      toUpdate: {},
      toReplace: {},
      toDelete: {},
    };
    let applyErr;
    try {
      if (modulesWithChanges.length) {
        logger.scope({ dbId }).info('Starting apply phase for modules with changes');
        const applyRes = await commitApply(
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
      logger.scope({ dbId }).warn(`Something failed applying for modules with changes.\n${e}`);
      applyErr = e;
    }
    if (applyErr) {
      try {
        logger.scope({ dbId }).info(`Starting apply phase for all modules`);
        await commitApply(dbId, installedModulesSorted, context, force, crupdes, dryRun);
        applyErr = null;
      } catch (e) {
        logger.scope({ dbId }).warn(`Something failed applying for all modules.\n${e}`);
        applyErr = e;
      }
    }
    let syncRes, syncErr;
    try {
      logger.scope({ dbId }).info('Starting sync phase for all modules');
      syncRes = await commitSync(dbId, installedModulesSorted, context, force, crupdes, dryRun);
    } catch (e) {
      logger.scope({ dbId }).warn(`Something failed during sync phase for all modules\n${e}`);
      syncErr = e;
    }
    if (applyErr || syncErr) {
      let rollbackErr;
      try {
        await realRollback(dbId, context, orm, installedModulesSorted, crupdes);
      } catch (e) {
        rollbackErr = e;
      }
      const errMessage = mergeErrorMessages([rollbackErr, syncErr, applyErr]);
      const err: any | Error =
        applyErr ?? syncErr ?? rollbackErr ?? new Error(`Something went wrong. ${errMessage}`);
      err.message = errMessage;
      throw err;
    }
    return syncRes;
  } catch (e: any) {
    debugObj(e);
    await insertErrorLog(orm, logErrSentry(e));
    throw e;
  } finally {
    // Create end commit object
    await insertLog(orm, dryRun ? 'preview_end' : 'end');
    // do not drop the conn if it was provided
    if (orm !== ormOpt) orm?.dropConn();
    if (parentOrm) context.orm = parentOrm;
  }
}

// TODO: rename
async function realRollback(
  dbId: string,
  ctx: Context,
  orm: TypeormWrapper,
  installedModules: ModuleInterface[],
  crupdes: { toCreate: Crupde; toUpdate: Crupde; toReplace: Crupde; toDelete: Crupde },
) {
  // TODO: TRACK ROLLBACK EVENTS IN AUDIT LOGS
  const changeLogs: IasqlAuditLog[] = await getChangeLogsSinceLastBegin(orm);
  const modsIndexedByTable = indexModsByTable(installedModules);
  const inverseQueries: string[] = await getInverseQueries(changeLogs, modsIndexedByTable, orm);
  console.log(`+-+ INVERSE QUERIES = ${inverseQueries}`);
  for (const q of inverseQueries) {
    await orm.query(q);
  }
  await commitApply(dbId, installedModules, ctx, true, crupdes, false);
}

async function getChangeLogsSinceLastBegin(orm: TypeormWrapper): Promise<IasqlAuditLog[]> {
  const transaction: IasqlAuditLog = await orm.findOne(IasqlAuditLog, {
    order: { ts: 'DESC' },
    skip: 0,
    take: 1,
    where: {
      changeType: AuditLogChangeType.OPEN_TRANSACTION,
    },
  });
  if (!transaction) throw new Error('No open transaction');
  return await orm.find(IasqlAuditLog, {
    order: { ts: 'DESC' },
    where: {
      changeType: In([AuditLogChangeType.INSERT, AuditLogChangeType.UPDATE, AuditLogChangeType.DELETE]),
      ts: MoreThan(transaction.ts),
    },
  });
}

async function getInverseQueries(
  changeLogs: IasqlAuditLog[],
  mbt: { [key: string]: ModuleInterface },
  orm: TypeormWrapper,
): Promise<string[]> {
  const inverseQueries: string[] = [];
  let values: any[];
  for (const cl of changeLogs) {
    let inverseQuery: string = '';
    switch (cl.changeType) {
      case AuditLogChangeType.INSERT:
        inverseQuery = `
          DELETE FROM ${cl.tableName}
          WHERE ${Object.entries(cl.change?.change ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(([k, v]: [string, any]) => getCondition(k, v))
            .join(' AND ')};
        `;
        break;
      case AuditLogChangeType.DELETE:
        values = await Promise.all(
          Object.entries(cl.change?.original ?? {})
            .filter(([k, v]: [string, any]) => k !== 'id' && v !== null)
            .map(async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt[cl.tableName], orm)),
        );
        inverseQuery = `
          INSERT INTO ${cl.tableName} (${Object.keys(cl.change?.original ?? {})
          .filter((k: string) => k !== 'id' && cl.change?.original[k] !== null)
          .join(', ')})
          VALUES (${values.join(', ')});
        `;
        break;
      case AuditLogChangeType.UPDATE:
        values = await Promise.all(
          Object.entries(cl.change?.original ?? {})
            .filter(([_, v]: [string, any]) => v !== null)
            .map(async ([k, v]: [string, any]) => await getValue(cl.tableName, k, v, mbt[cl.tableName], orm)),
        );
        inverseQuery = `
          UPDATE ${cl.tableName}
          SET ${Object.entries(cl.change?.original ?? {})
            .map(([k, _]: [string, any], i) => `${k} = ${values[i]}`)
            .join(', ')}
          WHERE ${Object.entries(cl.change?.change ?? {})
            .map(([k, v]: [string, any]) => getCondition(k, v))
            .join(' AND ')};
        `;
        break;
      default:
        break;
    }
    if (inverseQuery) inverseQueries.push(inverseQuery);
  }
  return inverseQueries;
}

function getCondition(k: string, v: any): string {
  if (typeof v === 'string') return `${k} = '${v}'`;
  if (v && typeof v === 'object') return `${k}::jsonb = '${JSON.stringify(v)}'::jsonb`;
  return `${k} = ${v}`;
}

// todo: how to make sure this handle all possible cases?
async function getValue(
  tableName: string,
  k: string,
  v: any,
  mod: ModuleInterface,
  orm: TypeormWrapper,
): Promise<string> {
  if (typeof v === 'string') return `'${v}'`;
  if (v && typeof v === 'object' && Array.isArray(v)) {
    const mappers = Object.values(mod).filter(val => val instanceof MapperBase);
    for (const m of mappers) {
      const metadata = await orm.getEntityMetadata((m as MapperBase<any>).entity);
      if (
        metadata.tableName === tableName &&
        metadata.ownerColumns
          .filter(oc => oc.isArray)
          .map(oc => oc.databaseName)
          .includes(k)
      ) {
        return `'{${v.join(',')}}'`;
      }
    }
  }
  if (v && typeof v === 'object') return `'${JSON.stringify(v)}'`;
  return `${v}`;
}

// TODO: rename
export async function rollback(dbId: string, context: Context, force = false, ormOpt?: TypeormWrapper) {
  const t1 = Date.now();
  logger.scope({ dbId }).info(`Sync to ${dbId}`);
  await throwIfUpgrading(dbId, force);
  const versionString = await TypeormWrapper.getVersionString(dbId);
  const importedModules = await getImportedModules(dbId, versionString, force);
  // We save the incoming orm from context if any and re-assign it before exiting
  const parentOrm = context?.orm;
  let orm: TypeormWrapper | null = null;
  try {
    orm = ormOpt ? ormOpt : await TypeormWrapper.createConn(dbId);
    context.orm = orm;

    const isRunning = await isCommitRunning(orm);
    if (isRunning) throw new Error('Another execution is in process. Please try again later.');

    const newStartCommit = await insertLog(orm, 'start');
    context.startCommit = newStartCommit;

    const installedModulesNames = (await orm.find(IasqlModule)).map((m: any) => m.name);
    const installedModules: ModuleInterface[] = (Object.values(importedModules) as ModuleInterface[]).filter(
      mod => installedModulesNames.includes(`${mod.name}@${mod.version}`),
    );
    const installedModulesSorted: ModuleInterface[] = sortModules(installedModules, installedModulesNames);

    const t2 = Date.now();
    logger.scope({ dbId }).info(`Setup took ${t2 - t1}ms`);

    const crupdes: { toCreate: Crupde; toUpdate: Crupde; toReplace: Crupde; toDelete: Crupde } = {
      toCreate: {},
      toUpdate: {},
      toReplace: {},
      toDelete: {},
    };
    return await commitSync(dbId, installedModulesSorted, context, force, crupdes, false);
  } catch (e: any) {
    debugObj(e);
    await insertErrorLog(orm, logErrSentry(e));
    throw e;
  } finally {
    // Create end commit object
    await insertLog(orm, 'end');
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
  type: 'start' | 'preview_start' | 'end' | 'preview_end' | 'open' | 'close',
): Promise<IasqlAuditLog> {
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
    case 'open':
      commitLog.changeType = AuditLogChangeType.OPEN_TRANSACTION;
      break;
    case 'close':
      commitLog.changeType = AuditLogChangeType.CLOSE_TRANSACTION;
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

// TODO: rename
async function commitApply(
  dbId: string,
  relevantModules: ModuleInterface[],
  context: Context,
  force: boolean,
  crupdes: { toCreate: Crupde; toUpdate: Crupde; toReplace: Crupde; toDelete: Crupde },
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
    logger.scope({ dbId }).info('Starting outer loop');
    ranFullUpdate = false;
    const tables = mappers.map(mapper => mapper.entity.name);
    context.memo.db = {}; // Flush the DB entities on the outer loop to restore the actual intended state
    await lazyLoader(
      mappers.map(mapper => async () => {
        await mapper.db.read(context);
      }),
      dbId,
    );
    // Every time we read from db we get possible changes that occured after this commit started
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
      logger.scope({ dbId }).info('Starting inner loop');
      ranUpdate = false;
      context.memo.cloud = {}; // Flush the Cloud entities on the inner loop to track changes to the state
      await lazyLoader(
        mappers.map(mapper => async () => {
          await mapper.cloud.read(context);
        }),
        dbId,
      );
      const t3 = Date.now();
      logger.scope({ dbId }).info(`Record acquisition time: ${t3 - t2}ms`);
      const records = colToRow({
        table: tables,
        mapper: mappers,
        dbEntity: tables.map(t => (context.memo.db[t] ? Object.values(context.memo.db[t]) : [])),
        cloudEntity: tables.map(t => (context.memo.cloud[t] ? Object.values(context.memo.cloud[t]) : [])),
        comparator: comparators,
        idGen: idGens,
      });
      const t4 = Date.now();
      logger.scope({ dbId }).info(`AWS Mapping time: ${t4 - t3}ms`);
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
      logger.scope({ dbId }).info(`Diff time: ${t5 - t4}ms`);
      const promiseGenerators = records
        .map(r => {
          const name = r.table;
          logger.scope({ dbId }).info(`Checking ${name}`);
          const outArr = [];
          recordsApplied += r.diff.entitiesInDbOnly.length;
          if (r.diff.entitiesInDbOnly.length > 0) {
            logger
              .scope({ dbId })
              .info(`${name} has records to create`, { records: r.diff.entitiesInDbOnly });
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
            logger.scope({ dbId }).info(`${name} has records to update`, { records: r.diff.entitiesChanged });
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
          logger.scope({ dbId }).info(`Checking ${name}`);
          const outArr = [];
          recordsApplied += r.diff.entitiesInAwsOnly.length;
          if (r.diff.entitiesInAwsOnly.length > 0) {
            logger
              .scope({ dbId })
              .info(`${name} has records to delete`, { records: r.diff.entitiesInAwsOnly });
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
        logger.scope({ dbId }).info(`AWS update time: ${t6 - t5}ms`);
      }
    } while (ranUpdate);
  } while (ranFullUpdate);
  const t7 = Date.now();
  logger.scope({ dbId }).info(`${dbId} applied and synced, total time: ${t7 - t1}ms`);
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

// TODO: rename
async function commitSync(
  dbId: string,
  relevantModules: ModuleInterface[],
  context: Context,
  force: boolean,
  crupdes: { toCreate: Crupde; toUpdate: Crupde; toReplace: Crupde; toDelete: Crupde },
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
      logger.scope({ dbId }).info(`Record acquisition time: ${t3 - t2}ms`);
      const records = colToRow({
        table: tables,
        mapper: mappers,
        dbEntity: tables.map(t => (context.memo.db[t] ? Object.values(context.memo.db[t]) : [])),
        cloudEntity: tables.map(t => (context.memo.cloud[t] ? Object.values(context.memo.cloud[t]) : [])),
        comparator: comparators,
        idGen: idGens,
      });
      const t4 = Date.now();
      logger.scope({ dbId }).info(`AWS Mapping time: ${t4 - t3}ms`);
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
      logger.scope({ dbId }).info(`Diff time: ${t5 - t4}ms`);
      const promiseGenerators = records
        .map(r => {
          const name = r.table;
          logger.scope({ dbId }).info(`Checking ${name}`);
          const outArr = [];
          recordsSynced += r.diff.entitiesInAwsOnly.length;
          if (r.diff.entitiesInAwsOnly.length > 0) {
            logger
              .scope({ dbId })
              .info(`${name} has records to create`, { records: r.diff.entitiesInAwsOnly });
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
            logger.scope({ dbId }).info(`${name} has records to update`, { records: r.diff.entitiesChanged });
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
          logger.scope({ dbId }).info(`Checking ${name}`);
          const outArr = [];
          recordsSynced += r.diff.entitiesInDbOnly.length;
          if (r.diff.entitiesInDbOnly.length > 0) {
            logger
              .scope({ dbId })
              .info(`${name} has records to delete`, { records: r.diff.entitiesInDbOnly });
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
        logger.scope({ dbId }).info(`AWS update time: ${t6 - t5}ms`);
      }
    } while (ranUpdate);
  } while (ranFullUpdate);
  const t7 = Date.now();
  logger.scope({ dbId }).info(`${dbId} synced, total time: ${t7 - t1}ms`);
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
  Object.entries(originalChange).forEach(([k, v]: [string, any]) => (originalE[camelCase(k)] = v));
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
      targetEntity: or.inverseEntityMetadata.target,
      propertyName: or.propertyName,
      colsWithReferences: or.joinColumns.map(jc => [jc.databaseName, jc.referencedColumn?.databaseName]),
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

function indexModsByTable(mods: ModuleInterface[]): { [key: string]: ModuleInterface } {
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
  // Check if no other transaction is open in the last 30 min
  // Check if no commit is running
  let addedTransaction = false,
    loops = 120;
  do {
    const [isRunning, openTransaction] = await Promise.all([isCommitRunning(orm), isOpenTransaction(orm)]);
    if (!isRunning && !openTransaction) {
      await insertLog(orm, 'open');
      addedTransaction = true;
    } else {
      await new Promise(r => setTimeout(r, 1000)); // Sleep for a sec
      loops--;
    }
  } while (!addedTransaction && !!loops);
  if (!addedTransaction) throw new Error('Another transaction is open or running. Please try again later.');
}

export async function closeTransaction(orm: TypeormWrapper): Promise<void> {
  await insertLog(orm, 'close');
}

export async function isOpenTransaction(orm: TypeormWrapper): Promise<boolean> {
  const limitDate = new Date(Date.now() - 30 * 60 * 1000);
  const transactions = await orm.find(IasqlAuditLog, {
    order: { ts: 'DESC' },
    where: {
      changeType: In([AuditLogChangeType.OPEN_TRANSACTION, AuditLogChangeType.CLOSE_TRANSACTION]),
      ts: MoreThan(limitDate),
    },
    take: 1,
  });
  return !!transactions?.length && transactions[0].changeType === AuditLogChangeType.OPEN_TRANSACTION;
}

export async function insertErrorLog(orm: TypeormWrapper | null, err: string): Promise<void> {
  const errorLog = new IasqlAuditLog();
  errorLog.user = config.db.user;
  errorLog.change = {};
  errorLog.message = err;
  errorLog.changeType = AuditLogChangeType.ERROR;
  errorLog.tableName = 'iasql_audit_log';
  errorLog.ts = new Date();
  await orm?.save(IasqlAuditLog, errorLog);
}
