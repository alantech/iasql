import * as express from 'express'
import { createConnection, } from 'typeorm'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

import config from '../config';
import { TypeormWrapper, } from '../services/typeorm'
import { IasqlModule, } from '../entity'
import { findDiff, } from '../services/diff'
import { lazyLoader, } from '../services/lazy-dep'
import { delId, getAliases, getId, migrate, newId, } from '../services/db-manager'
import * as Modules from '../modules'
import { handleErrorMessage } from '.'


export const db = express.Router();

const baseConnConfig: PostgresConnectionOptions = {
  name: 'base', // If you use multiple connections they must have unique names or typeorm bails
  type: 'postgres',
  username: config.dbUser,
  password: config.dbPassword,
  host: config.dbHost,
};

// TODO secure with cors and scope
db.post('/add', async (req, res) => {
  console.log('Calling /add');
  const {dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey} = req.body;
  if (!dbAlias || !awsRegion || !awsAccessKeyId || !awsSecretAccessKey) return res.json(
    `Required key(s) not provided: ${[
      'dbAlias', 'awsRegion', 'awsAccessKeyId', 'awsSecretAccessKey'
    ].filter(k => !req.body.hasOwnProperty(k)).join(', ')}`
  );
  let conn1, conn2;
  let orm: TypeormWrapper | undefined;
  try {
    const dbId = await newId(dbAlias, req.user);
    console.log('Establishing DB connections...');
    conn1 = await createConnection(baseConnConfig);
    await conn1.query(`
      CREATE DATABASE ${dbId};
    `);
    conn2 = await createConnection({
      ...baseConnConfig,
      name: dbId,
      database: dbId,
    });
    await migrate(conn2);
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
    console.log('Creating account for user...');
    // Create a randomly generated username and password, an 8 char username [a-z][a-z0-9]{7} and a
    // 16 char password [a-zA-Z0-9!@#$%^*]{16}
    const userFirstCharCharset = [
      Array(26).fill('a').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
    ].flat();
    const userRestCharCharset = [
      ...userFirstCharCharset,
      Array(10).fill('0').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
    ].flat();
    const passwordCharset = [
      ...userRestCharCharset,
      Array(26).fill('A').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
      '!@#$%^*'.split(''),
    ].flat();
    const randChar = (a: string[]): string => a[Math.floor(Math.random() * a.length)];
    const user = [
      randChar(userFirstCharCharset),
      Array(7).fill('').map(() => randChar(userRestCharCharset)),
    ].flat().join('');
    const pass = Array(16).fill('').map(() => randChar(passwordCharset)).join('');
    // TODO: The permissions below work just fine, but prevent the users from creating their own
    // tables. We want to allow that in the future, but not sure the precise details of how, as
    // the various options have their own trade-offs and potential sources of bugs to worry about.
    // But we'll want to decide (before public launch?) one of them and replace this
    await conn2.query(`
      CREATE ROLE ${user} LOGIN PASSWORD '${pass}';
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${user};
      GRANT INSERT ON ALL TABLES IN SCHEMA public TO ${user};
      GRANT UPDATE ON ALL TABLES IN SCHEMA public TO ${user};
      GRANT DELETE ON ALL TABLES IN SCHEMA public TO ${user};
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${user};
      GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO ${user};
      GRANT CONNECT ON DATABASE ${dbId} TO ${user};
    `);
    console.log('Done!');
    res.json({
      dbAlias,
      dbId,
      user,
      pass,
    });
  } catch (e: any) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  } finally {
    await conn1?.close();
    await conn2?.close();
    await orm?.dropConn();
  }
});

db.get('/list', async (req, res) => {
  let conn;
  try {
    conn = await createConnection(baseConnConfig);
    // aliases is undefined when there is no auth so get aliases from DB
    const aliases = (await getAliases(req.user)) ?? (await conn.query(`
      select datname
      from pg_database
      where datname <> 'postgres' and
      datname <> 'template0' and
      datname <> 'template1'
    `)).map((r: any) => r.datname);
    res.json(aliases);
  } catch (e: any) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  } finally {
    conn?.close();
  }
});

db.get('/remove/:dbAlias', async (req, res) => {
  const dbAlias = req.params.dbAlias;
  let conn;
  try {
    const dbId = await getId(dbAlias, req.user);
    conn = await createConnection(baseConnConfig);
    await conn.query(`
      DROP DATABASE ${dbId} WITH (FORCE);
    `);
    await delId(dbAlias, req.user);
    res.end(`removed ${dbAlias}`);
  } catch (e: any) {
    res.status(500).end(`${handleErrorMessage(e)}`);
  } finally {
    conn?.close();
  }
});

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

db.get('/apply/:dbAlias', async (req, res) => {
  const dbAlias = req.params.dbAlias;
  const t1 = Date.now();
  console.log(`Applying ${dbAlias}`);
  let orm: TypeormWrapper | null = null;
  try {
    const dbId = await getId(dbAlias, req.user);
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
          return res.end(`${dbAlias} checked and synced, total time: ${t4 - t1}ms`);
        }
        records.forEach(r => {
          r.diff = findDiff(r.dbEntity, r.cloudEntity, r.idGen, r.comparator);
        });
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
    res.end(`${dbAlias} applied and synced, total time: ${t7 - t1}ms`);
  } catch (e: any) {
    console.dir(e, { depth: 6, });
    res.status(500).end(`${handleErrorMessage(e)}`);
  } finally {
    orm?.dropConn();
  }
});
