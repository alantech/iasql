import { promisify, } from 'util'
import { exec as execNode, } from 'child_process'
const exec = promisify(execNode);


import { createConnection, } from 'typeorm'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'

import config from '../config'
import { DepError, lazyLoader, } from '../services/lazy-dep'
import { findDiff, } from '../services/diff'
import { TypeormWrapper, } from './typeorm'
import { IasqlModule, } from '../entity'
import { sortModules, } from './mod-sort'
import * as dbMan from './db-manager'
import * as Modules from '../modules'

// Crupde = CR-UP-DE, Create/Update/Delete
type Crupde = { [key: string]: { columns: string[], records: string[][], }, };
export function recordCount(crupde: Crupde) {
  return Object.values(crupde).map(r => r.records.length).reduce((cumu, curr) => cumu + curr, 0);
}

export async function add(
  dbAlias: string,
  awsRegion: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  user: any, // TODO: Better type here
) {
  let conn1: any, conn2: any, dbId: any, dbUser: any;
  let orm: TypeormWrapper | undefined;
  try {
    console.log('Creating account for user...');
    const dbGen = dbMan.genUserAndPass();
    dbUser = dbGen[0];
    const dbPass = dbGen[1];
    const meta = await dbMan.setMetadata(dbAlias, dbUser, user);
    dbId = meta.dbId;
    console.log('Establishing DB connections...');
    conn1 = await createConnection(dbMan.baseConnConfig);
    await conn1.query(`
      CREATE DATABASE ${dbId};
    `);
    conn2 = await createConnection({
      ...dbMan.baseConnConfig,
      name: dbId,
      database: dbId,
    });
    await dbMan.migrate(conn2);
    const queryRunner = conn2.createQueryRunner();
    await Modules.AwsAccount.migrations.postinstall?.(queryRunner);
    console.log('Adding aws_account schema...');
    // TODO: Use the entity for this in the future?
    await conn2.query(`
      INSERT INTO iasql_module VALUES ('aws_account')
    `);
    await conn2.query(`
      INSERT INTO region (name, endpoint, opt_in_status) VALUES ('${awsRegion}', '', false)
    `);
    await conn2.query(`
      INSERT INTO aws_account (access_key_id, secret_access_key, region_id) VALUES ('${awsAccessKeyId}', '${awsSecretAccessKey}', 1)
    `);
    console.log('Loading aws_account data...');
    // Manually load the relevant data from the cloud side for the `aws_account` module.
    // TODO: Figure out how to eliminate *most* of this special-casing for this module in the future
    const entities: Function[] = Object.values(Modules.AwsAccount.mappers).map(m => m.entity);
    entities.push(IasqlModule);
    orm = await TypeormWrapper.createConn(dbId, {entities} as PostgresConnectionOptions);
    const mappers = Object.values(Modules.AwsAccount.mappers);
    const context: Modules.Context = { orm, memo: {}, ...Modules.AwsAccount.provides.context, };
    for (const mapper of mappers) {
      console.log(`Loading aws_account table ${mapper.entity.name}...`);
      const e = await mapper.cloud.read(context);
      if (!e || (Array.isArray(e) && !e.length)) {
        console.log(`${mapper.entity.name} has no records in the cloud to store`);
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
    if (dbUser) await conn1?.query(dbMan.dropPostgresRoleQuery(dbUser));
    await dbMan.delMetadata(dbAlias, user);
    // rethrow the error
    throw e;
  } finally {
    await conn1?.close();
    await conn2?.close();
    await orm?.dropConn();
  }
}

export async function remove(dbAlias: string, user: any) {
  let conn;
  try {
    const { dbId, dbUser } = await dbMan.getMetadata(dbAlias, user);
    conn = await createConnection(dbMan.baseConnConfig);
    await conn.query(`
      DROP DATABASE ${dbId} WITH (FORCE);
    `);
    await conn.query(dbMan.dropPostgresRoleQuery(dbUser));
    await dbMan.delMetadata(dbAlias, user);
    return `removed ${dbAlias}`;
  } catch (e: any) {
    // re-throw
    throw e;
  } finally {
    conn?.close();
  }
}

export async function list(user: any) {
  let conn;
  try {
    conn = await createConnection(dbMan.baseConnConfig);
    // aliases is undefined when there is no auth so get aliases from DB
    const aliases = (await dbMan.getAliases(user)) ?? (await conn.query(`
      select datname
      from pg_database
      where datname <> 'postgres' and
      datname <> 'template0' and
      datname <> 'template1'
    `)).map((r: any) => r.datname);
    return aliases;
  } catch (e: any) {
    throw e;
  } finally {
    conn?.close();
  }
}

export async function dump(dbAlias: string, user: any) {
  let dbId;
  try {
    const meta = await dbMan.getMetadata(dbAlias, user);
    dbId = meta.dbId;
  } catch (e: any) {
    throw e;
  }
  // Using the main user and password, not the users' own account here
  const pgUrl = `postgres://${encodeURIComponent(config.dbUser)}:${encodeURIComponent(
    config.dbPassword
  )}@${config.dbHost}/${dbId}`;
  const { stdout, } = await exec(`pg_dump --inserts -x ${pgUrl}`, { shell: '/bin/bash', });
  return stdout;
}

export async function load(
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
    const regions = await conn2.query(`
      SELECT id from public.region WHERE name = '${awsRegion}' LIMIT 1;
    `);
    await conn2.query(`
      UPDATE public.aws_account
      SET access_key_id = '${awsAccessKeyId}', secret_access_key = '${awsSecretAccessKey}', region_id = '${regions[0].id}'
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
}

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

export async function apply(dbAlias: string, dryRun: boolean, user: any) {
  const t1 = Date.now();
  console.log(`Applying ${dbAlias}`);
  let orm: TypeormWrapper | null = null;
  try {
    const { dbId } = await dbMan.getMetadata(dbAlias, user);
    // Construct the ORM client with all of the entities we may wish to query
    const entities = Object.values(Modules)
      .filter(m => m.hasOwnProperty('provides'))
      .map((m: any) => Object.values(m.provides.entities))
      .flat()
      .filter(e => typeof e === 'function') as Function[];
    entities.push(IasqlModule);
    orm = await TypeormWrapper.createConn(dbId, {entities} as PostgresConnectionOptions);
    // Find all of the installed modules, and create the context object only for these
    const moduleNames = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
    const memo: any = {}; // TODO: Stronger typing here
    const context: Modules.Context = { orm, memo, }; // Every module gets access to the DB
    for (const name of moduleNames) {
      const mod = Object.values(Modules).find(m => m.name === name) as Modules.ModuleInterface;
      if (!mod) throw new Error(`This should be impossible. Cannot find module ${name}`);
      const moduleContext = mod.provides.context ?? {};
      Object.keys(moduleContext).forEach(k => context[k] = moduleContext[k]);
    }
    // Get the relevant mappers, which are the ones where the DB is the source-of-truth
    const mappers = Object.values(Modules)
      .filter(mod => moduleNames.includes(mod.name))
      .map(mod => Object.values((mod as Modules.ModuleInterface).mappers))
      .flat()
      .filter(mapper => mapper.source === 'db');
    const t2 = Date.now();
    console.log(`Setup took ${t2 - t1}ms`);
    let ranFullUpdate = false;
    let failureCount = -1;
    const toCreate: Crupde = {};
    const toUpdate: Crupde = {};
    const toReplace: Crupde = {};
    const toDelete: Crupde = {};
    let createCount = -1;
    let updateCount = -1;
    let replaceCount = -1;
    let deleteCount = -1;
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
        console.log(`Record acquisition time: ${t3 - t2}ms`);
        const records = colToRow({
          table: tables,
          mapper: mappers,
          dbEntity: tables.map(t => memo.db[t] ? Object.values(memo.db[t]) : []),
          cloudEntity: tables.map(t => memo.cloud[t] ? Object.values(memo.cloud[t]) : []),
          comparator: comparators,
          idGen: idGens,
        });
        const t4 = Date.now();
        console.log(`AWS Mapping time: ${t4 - t3}ms`);
        if (!records.length) { // Only possible on just-created databases
          return {
            iasqlPlanVersion: 2,
            toCreate: {},
            toUpdate: {},
            toReplace: {},
            toDelete: {},
          };
        }
        const updatePlan = (
          crupde: Crupde,
          entityName: string,
          mapper: Modules.MapperInterface<any>,
          es: any[]
        ) => {
          const rs = es.map((e: any) => mapper.entityPrint(e));
          crupde[entityName] = crupde[entityName] ?? {
            columns: Object.keys(rs[0]),
            records: rs.map((r2: any) => Object.values(r2)),
          };
        }
        records.forEach(r => {
          r.diff = findDiff(r.dbEntity, r.cloudEntity, r.idGen, r.comparator);
          if (r.diff.entitiesInDbOnly.length > 0) {
            updatePlan(toCreate, r.table, r.mapper, r.diff.entitiesInDbOnly);
          } else {
            delete toCreate[r.table];
          }
          if (r.diff.entitiesInAwsOnly.length > 0) {
            updatePlan(toDelete, r.table, r.mapper, r.diff.entitiesInAwsOnly);
          } else {
            delete toDelete[r.table];
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
            if (updates.length > 0) {
              updatePlan(toUpdate, r.table, r.mapper, updates);
            } else {
              delete toUpdate[r.table];
            }
            if (replaces.length > 0) {
              updatePlan(toReplace, r.table, r.mapper, replaces);
            } else {
              delete toReplace[r.table];
            }
          }
        });
        if (dryRun) return {
          iasqlPlanVersion: 2,
          toCreate,
          toUpdate,
          toReplace,
          toDelete,
        };
        const nextCreateCount = recordCount(toCreate);
        const nextUpdateCount = recordCount(toUpdate);
        const nextReplaceCount = recordCount(toReplace);
        const nextDeleteCount = recordCount(toDelete);
        if (
          createCount === nextCreateCount &&
          updateCount === nextUpdateCount &&
          replaceCount === nextReplaceCount &&
          deleteCount === nextDeleteCount
        ) {
          spinCount++;
        } else {
          createCount = nextCreateCount;
          updateCount = nextUpdateCount;
          replaceCount = nextReplaceCount;
          deleteCount = nextDeleteCount;
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
        console.log(`Diff time: ${t5 - t4}ms`);
        const promiseGenerators = records
          .map(r => {
            const name = r.table;
            console.log(`Checking ${name}`);
            const outArr = [];
            if (r.diff.entitiesInDbOnly.length > 0) {
              console.log(`${name} has records to create`);
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
              console.log(`${name} has records to update`);
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
              console.log(`${name} has records to delete`);
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
          console.log(`AWS update time: ${t6 - t5}ms`);
        }
      } while(ranUpdate);
    } while (ranFullUpdate);
    const t7 = Date.now();
    console.log(`${dbAlias} applied and synced, total time: ${t7 - t1}ms`);
    return {
      iasqlPlanVersion: 2,
      toCreate,
      toUpdate,
      toReplace,
      toDelete,
    };
  } catch (e: any) {
    console.dir(e, { depth: 6, });
    throw e;
  } finally {
    orm?.dropConn();
  }
}

export async function sync(dbAlias: string, dryRun: boolean, user: any) {
  const t1 = Date.now();
  console.log(`Syncing ${dbAlias}`);
  let orm: TypeormWrapper | null = null;
  try {
    const { dbId } = await dbMan.getMetadata(dbAlias, user);
    // Construct the ORM client with all of the entities we may wish to query
    const entities = Object.values(Modules)
      .filter(m => m.hasOwnProperty('provides'))
      .map((m: any) => Object.values(m.provides.entities))
      .flat()
      .filter(e => typeof e === 'function') as Function[];
    entities.push(IasqlModule);
    orm = await TypeormWrapper.createConn(dbId, {entities} as PostgresConnectionOptions);
    // Find all of the installed modules, and create the context object only for these
    const moduleNames = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
    const memo: any = {}; // TODO: Stronger typing here
    const context: Modules.Context = { orm, memo, }; // Every module gets access to the DB
    for (const name of moduleNames) {
      const mod = Object.values(Modules).find(m => m.name === name) as Modules.ModuleInterface;
      if (!mod) throw new Error(`This should be impossible. Cannot find module ${name}`);
      const moduleContext = mod.provides.context ?? {};
      Object.keys(moduleContext).forEach(k => context[k] = moduleContext[k]);
    }
    // Get the mappers, regardless of source-of-truth
    const mappers = Object.values(Modules)
      .filter(mod => moduleNames.includes(mod.name))
      .map(mod => Object.values((mod as Modules.ModuleInterface).mappers))
      .flat();
    const t2 = Date.now();
    console.log(`Setup took ${t2 - t1}ms`);
    let ranFullUpdate = false;
    let failureCount = -1;
    const toCreate: Crupde = {};
    const toUpdate: Crupde = {};
    const toReplace: Crupde = {}; // Not actually used in sync mode, at least right now
    const toDelete: Crupde = {};
    let createCount = -1;
    let updateCount = -1;
    let replaceCount = -1;
    let deleteCount = -1;
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
        console.log(`Record acquisition time: ${t3 - t2}ms`);
        const records = colToRow({
          table: tables,
          mapper: mappers,
          dbEntity: tables.map(t => memo.db[t] ? Object.values(memo.db[t]) : []),
          cloudEntity: tables.map(t => memo.cloud[t] ? Object.values(memo.cloud[t]) : []),
          comparator: comparators,
          idGen: idGens,
        });
        const t4 = Date.now();
        console.log(`AWS Mapping time: ${t4 - t3}ms`);
        if (!records.length) { // Only possible on just-created databases
          return {
            iasqlPlanVersion: 2,
            toCreate: {},
            toUpdate: {},
            toReplace: {},
            toDelete: {},
          };
        }
        const updatePlan = (
          crupde: Crupde,
          entityName: string,
          mapper: Modules.MapperInterface<any>,
          es: any[]
        ) => {
          const rs = es.map((e: any) => mapper.entityPrint(e));
          crupde[entityName] = crupde[entityName] ?? {
            columns: Object.keys(rs[0]),
            records: rs.map((r2: any) => Object.values(r2)),
          };
        }
        records.forEach(r => {
          r.diff = findDiff(r.dbEntity, r.cloudEntity, r.idGen, r.comparator);
          if (r.diff.entitiesInDbOnly.length > 0) {
            updatePlan(toDelete, r.table, r.mapper, r.diff.entitiesInDbOnly);
          } else {
            delete toDelete[r.table];
          }
          if (r.diff.entitiesInAwsOnly.length > 0) {
            updatePlan(toCreate, r.table, r.mapper, r.diff.entitiesInAwsOnly);
          } else {
            delete toCreate[r.table];
          }
          if (r.diff.entitiesChanged.length > 0) {
            const updates: any[] = [];
            r.diff.entitiesChanged.forEach((e: any) => {
              updates.push(e.cloud);
            });
            if (updates.length > 0) {
              updatePlan(toUpdate, r.table, r.mapper, updates);
            } else {
              delete toUpdate[r.table];
            }
          }
        });
        if (dryRun) return {
          iasqlPlanVersion: 2,
          toCreate,
          toUpdate,
          toReplace,
          toDelete,
        };
        const nextCreateCount = recordCount(toCreate);
        const nextUpdateCount = recordCount(toUpdate);
        const nextReplaceCount = recordCount(toReplace);
        const nextDeleteCount = recordCount(toDelete);
        if (
          createCount === nextCreateCount &&
          updateCount === nextUpdateCount &&
          replaceCount === nextReplaceCount &&
          deleteCount === nextDeleteCount
        ) {
          spinCount++;
        } else {
          createCount = nextCreateCount;
          updateCount = nextUpdateCount;
          replaceCount = nextReplaceCount;
          deleteCount = nextDeleteCount;
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
        console.log(`Diff time: ${t5 - t4}ms`);
        const promiseGenerators = records
          .map(r => {
            const name = r.table;
            console.log(`Checking ${name}`);
            const outArr = [];
            if (r.diff.entitiesInAwsOnly.length > 0) {
              console.log(`${name} has records to create`);
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
              console.log(`${name} has records to update`);
              outArr.push(r.diff.entitiesChanged.map((ec: any) => async () => {
                const out = await r.mapper.db.update(ec.db, context); // Assuming SoT is the DB
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
              console.log(`${name} has records to delete`);
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
          console.log(`AWS update time: ${t6 - t5}ms`);
        }
      } while(ranUpdate);
    } while (ranFullUpdate);
    const t7 = Date.now();
    console.log(`${dbAlias} synced, total time: ${t7 - t1}ms`);
    return {
      iasqlPlanVersion: 2,
      toCreate,
      toUpdate,
      toReplace,
      toDelete,
    };
  } catch (e: any) {
    console.dir(e, { depth: 6, });
    throw e;
  } finally {
    orm?.dropConn();
  }
}

export async function modules(all: boolean, installed: boolean, dbAlias: string, user: any) {
  // TODO rm special casing for aws_account
  const allModules = Object.values(Modules)
    .filter(m => m.hasOwnProperty('mappers') && m.hasOwnProperty('name') && m.name !== 'aws_account')
    .map((m: any) => ({'name': m.name, 'dependencies': m.dependencies.filter((d: any) => d !== 'aws_account')}));
  if (all) {
    return allModules;
  } else if (installed && dbAlias) {
    const { dbId } = await dbMan.getMetadata(dbAlias, user);
    const entities: Function[] = [IasqlModule];
    const orm = await TypeormWrapper.createConn(dbId, {entities} as PostgresConnectionOptions);
    const mods = await orm.find(IasqlModule);
    const modsInstalled = mods.map((m: IasqlModule) => (m.name));
    return allModules.filter(m => modsInstalled.includes(m.name));
  } else {
    throw new Error('Invalid request parameters');
  }
}

export async function install(moduleList: string[], dbAlias: string, user: any) {
  const { dbId, dbUser } = await dbMan.getMetadata(dbAlias, user);
  // Check to make sure that all specified modules actually exist
  const mods = moduleList.map((n: string) => Object.values(Modules).find(m => m.name === n)) as Modules.ModuleInterface[];
  if (mods.some((m: any) => m === undefined)) {
    throw new Error(`The following modules do not exist: ${
      moduleList.filter((n: string) => !Object.values(Modules).find(m => m.name === n)).join(' , ')
    }`);
  }
  // Check to make sure that all dependent modules are in the list
  const missingDeps = mods.map((m: Modules.ModuleInterface) => m.dependencies.find(d => !moduleList.includes(d)));
  // TODO rm special casing for aws_account
  if (missingDeps.some((m: any) => m !== undefined && m !== 'aws_account')) {
    throw new Error(`The provided modules depend on the following modules: ${
      missingDeps.filter(n => n !== undefined).join(' , ')
    }`);
  }
  // Grab all of the entities plus the IaSQL Module entity itself and create the TypeORM connection
  // with it. Theoretically only need the module in question at first, but when we try to use the
  // module to acquire the cloud records, it may use one or more other modules it depends on, so
  // we just load them all into the TypeORM client.
  const entities = Object.values(Modules)
    .filter(m => m.hasOwnProperty('provides'))
    .map((m: any) => Object.values(m.provides.entities))
    .flat()
    .filter(e => typeof e === 'function') as Function[];
  entities.push(IasqlModule);
  const orm = await TypeormWrapper.createConn(dbId, {entities} as PostgresConnectionOptions);
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
    await sync(dbAlias, false, user);
  } catch (e) {
    console.log('Sync during module install failed');
    console.log(e);
    throw e;
  }
  // Sort the modules based on their dependencies, with both root-to-leaf order and vice-versa
  const rootToLeafOrder = sortModules(mods, existingModules);
  const leafToRootOrder = [...rootToLeafOrder].reverse();
  // Actually run the installation. First running all of the preinstall scripts from leaf-to-root,
  // then all of the postinstall scripts from root-to-leaf. Wrapped in a transaction so any failure
  // at this point when we're actually mutating the database doesn't leave things in a busted state.
  await queryRunner.startTransaction();
  try {
    for (const md of leafToRootOrder) {
      if (md.migrations?.preinstall) {
        await md.migrations.preinstall(queryRunner);
      }
    }
    for (const md of rootToLeafOrder) {
      if (md.migrations?.postinstall) {
        await md.migrations.postinstall(queryRunner);
      }
      const e = new IasqlModule();
      e.name = md.name;
      e.dependencies = await Promise.all(
        md.dependencies.map(async (dep) => await orm.findOne(IasqlModule, { name: dep, }))
      );
      await orm.save(IasqlModule, e);
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
    const md = Object.values(Modules).find(m => m.name === name) as Modules.ModuleInterface;
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
        } catch (err) {
          console.log(`Error reading from cloud entitiy ${mapper.entity.name}`);
          console.error(err);
          throw err;
        }
        if (!e || (Array.isArray(e) && !e.length)) {
          console.log('Completely unexpected outcome');
          console.log({ mapper, e, });
        } else {
          try {
            await mapper.db.create(e, context);
          } catch (err) {
            console.log(`Error importing from cloud entitiy ${mapper.entity.name}`);
            console.error(err);
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

export async function uninstall(moduleList: string[], dbAlias: string, user: any) {
  const { dbId } = await dbMan.getMetadata(dbAlias, user);
  // Check to make sure that all specified modules actually exist
  const mods = moduleList.map((n: string) => Object.values(Modules).find(m => m.name === n)) as Modules.ModuleInterface[];
  if (mods.some((m: any) => m === undefined)) {
    throw new Error(`The following modules do not exist: ${
      moduleList.filter((n: string) => !Object.values(Modules).find(m => m.name === n)).join(' , ')
    }`);
  }
  // Grab all of the entities from the module plus the IaSQL Module entity itself and create the
  // TypeORM connection with it.
  const entities = Object.values(Modules)
    .filter(m => m.hasOwnProperty('provides'))
    .map((m: any) => Object.values(m.provides.entities))
    .flat()
    .filter(e => typeof e === 'function') as Function[];
  entities.push(IasqlModule);
  const orm = await TypeormWrapper.createConn(dbId, {entities} as PostgresConnectionOptions);
  const queryRunner = orm.createQueryRunner();
  await queryRunner.connect();
  // See what modules are already uninstalled and prune them from the list
  const existingModules = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
  for (let i = 0; i < mods.length; i++) {
    if (!existingModules.includes(mods[i].name)) {
      mods.splice(i, 1);
      i--;
    }
  }
  // See if we need to abort because now there's nothing to do
  if (mods.length === 0) {
    throw new Error("All modules already uninstalled.");
  }
  const remainingModules = existingModules.filter((m: string) => !mods.some(m2 => m2.name === m));
  // Sort the modules based on their dependencies, with both root-to-leaf order and vice-versa
  const rootToLeafOrder = sortModules(mods, remainingModules);
  const leafToRootOrder = [...rootToLeafOrder].reverse();
  // Actually run the removal. First running all of the preremove scripts from leaf-to-root, then
  // all of the postremove scripts from root-to-leaf. Wrapped in a transaction so any failure at
  // this point when we're actually mutating the database doesn't leave things in a busted state.
  await queryRunner.startTransaction();
  try {
    for (const md of leafToRootOrder) {
      if (md.migrations?.preremove) {
        await md.migrations.preremove(queryRunner);
      }
    }
    for (const md of rootToLeafOrder) {
      if (md.migrations?.postremove) {
        await md.migrations.postremove(queryRunner);
      }
      const e = await orm.findOne(IasqlModule, { name: md.name, });
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
