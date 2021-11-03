import * as express from 'express'
import jwt from 'express-jwt'
import jwksRsa from 'jwks-rsa'
import { createConnection, } from 'typeorm'
import { SnakeNamingStrategy, } from 'typeorm-naming-strategies'

//import { AWS, } from '../services/gateways/aws'
import config from '../config'
import { TypeormWrapper, } from '../services/typeorm'
import { IasqlModule, } from '../entity'
//import * as Entities from '../entity'
//import * as Mappers from '../mapper'
//import { IndexedAWS, } from '../services/indexed-aws'
import { findDiff, } from '../services/diff'
//import { Source, } from '../services/source-of-truth'
//import { getAwsPrimaryKey, } from '../services/aws-primary-key'
import { lazyLoader, } from '../services/lazy-dep'
import { migrate, /*populate,*/ } from '../services/db-manager'
import * as Modules from '../modules'


export const db = express.Router();
db.use(express.json());

if (config.a0Enabled) {
  const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
      jwksUri: `${config.a0Domain}.well-known/jwks.json`,
    }),
    audience: config.a0Audience,
    issuer: config.a0Domain,
    algorithms: ['RS256'],
  });
  db.use(checkJwt);
}

// TODO secure with cors and scope
db.post('/create', async (req, res) => {
  //const t1 = Date.now();
  const {dbAlias, awsRegion, awsAccessKeyId, awsSecretAccessKey} = req.body;
  if (!dbAlias || !awsRegion || !awsAccessKeyId || !awsSecretAccessKey) return res.json(
    `Required key(s) not provided: ${[
      'dbAlias', 'awsRegion', 'awsAccessKeyId', 'awsSecretAccessKey'
    ].filter(k => !req.body.hasOwnProperty(k)).join(', ')}`
  );
  // TODO generate unique id as actual name and store association to alias in ironplans
  // such that once we auth the user they can use the alias and we map to the id
  const dbname = dbAlias;
  let conn1, conn2;
  try {
    conn1 = await createConnection({
      name: 'base', // If you use multiple connections they must have unique names or typeorm bails
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'postgresql',
    });
    const resp1 = await conn1.query(`
      CREATE DATABASE ${dbname};
    `);
    conn2 = await createConnection({
      name: dbname,
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'postgresql',
      database: dbname,
    });
    await migrate(conn2);
    const queryRunner = conn2.createQueryRunner();
    await Modules.AwsAccount.migrations.postinstall?.(queryRunner);
    // TODO: Use the entity for this in the future?
    await conn2.query(`
      INSERT INTO iasql_module VALUES ('aws_account', true, true)
    `);
    await conn2.query(`
      INSERT INTO aws_account (access_key_id, secret_access_key, region) VALUES ('${awsAccessKeyId}', '${awsSecretAccessKey}', '${awsRegion}')
    `);
    res.end(`create ${dbname}: ${JSON.stringify(resp1)}`);
  } catch (e: any) {
    res.status(500).end(`failure to create DB: ${e?.message ?? ''}\n${e?.stack ?? ''}`);
  } finally {
    await conn1?.close();
    await conn2?.close();
  }
});

db.get('/delete/:dbAlias', async (req, res) => {
  const dbname = req.params.dbAlias;
  let conn;
  try {
    conn = await createConnection({
      name: 'base',
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'postgresql',
    });
    await conn.query(`
      DROP DATABASE ${dbname};
    `);
    res.end(`delete ${dbname}`);
  } catch (e: any) {
    res.status(500).end(`failure to drop DB: ${e?.message ?? ''}`);
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

db.get('/check/:dbAlias', async (req, res) => {
  const dbname = req.params.dbAlias;
  const t1 = Date.now();
  console.log(`Checking ${dbname}`);
  let orm: TypeormWrapper | null = null;
  try {
    // Construct the ORM client with all of the entities we may wish to query
    const entities = Object.values(Modules)
      .filter(m => m.hasOwnProperty('mappers'))
      .map((m: any) => Object.values(m.mappers).map((ma: any) => ma.entity))
      .flat();
    entities.push(IasqlModule);
    orm = await TypeormWrapper.createConn(dbname, {
      name: req.body.dbname,
      type: 'postgres',
      username: 'postgres', // TODO: Should we use the user's account for this?
      password: 'test',
      host: 'postgresql',
      entities,
      namingStrategy: new SnakeNamingStrategy(), // TODO: Do we allow modules to change this?
    });
    // Find all of the installed modules, and create the context object only for these
    const moduleNames = (await orm.find(IasqlModule)).map((m: IasqlModule) => m.name);
    const context: Modules.Context = { orm, }; // Every module gets access to the DB
    for (let name of moduleNames) {
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
    do {
      ranFullUpdate = false;
      const tables = mappers.map(mapper => mapper.entity.name);
      const dbEntities: any[][] = [];
      await lazyLoader(mappers.map((mapper, i) => async () => {
        const entities = await mapper.db.read(context);
        dbEntities[i] = entities;
      }));
      const comparators = mappers.map(mapper => mapper.equals);
      const idGens = mappers.map(mapper => mapper.entityId);
      let ranUpdate = false;
      do {
        ranUpdate = false;
        const cloudEntities: any[][] = [];
        await lazyLoader(mappers.map((mapper, i) => async () => {
          const entities = await mapper.cloud.read(context);
          cloudEntities[i] = entities;
        }));
        const t3 = Date.now();
        console.log(`Record acquisition time: ${t3 - t2}ms`);
        const records = colToRow({
          table: tables,
          mapper: mappers,
          dbEntity: dbEntities,
          cloudEntity: cloudEntities,
          comparator: comparators,
          idGen: idGens,
        });
        const t4 = Date.now();
        console.log(`AWS Mapping time: ${t4 - t3}ms`);
        if (!records.length) { // Only possible on just-created databases
          return res.end(`${dbname} checked and synced, total time: ${t4 - t1}ms`);
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
              console.dir({
                toCreate: r.diff.entitiesInDbOnly,
              }, { depth: 4, });
              outArr.push(r.diff.entitiesInDbOnly.map((e: any) => async () => {
                const out = await r.mapper.cloud.create(e, context);
                if (out) {
                  const es = Array.isArray(out) ? out : [out];
                  es.forEach(e2 => {
                    // Mutate the original entity with the returned entity's properties so the actual
                    // record created is what is compared the next loop through
                    Object.keys(e2).forEach(k => e[k] = e2[k]);
                  });
                  // Save the new entity to the database, as well
                  await orm?.save(r.mapper.entity, out);
                }
              }));
            }
            if (r.diff.entitiesChanged.length > 0) {
              console.log(`${name} has records to update`);
              console.dir({
                entitesChanged: r.diff.entitiesChanged,
              }, { depth: 4, });
              outArr.push(r.diff.entitiesChanged.map((ec: any) => async () => {
                const out = await r.mapper.cloud.update(ec.db, context); // Assuming SoT is the DB
                if (out) {
                  const es = Array.isArray(out) ? out : [out];
                  es.forEach(e2 => {
                    // Mutate the original entity with the returned entity's properties so the actual
                    // record created is what is compared the next loop through
                    Object.keys(e2).forEach(k => ec.db[k] = e2[k]);
                  });
                  // TODO: Should we also save to ORM?
                }
              }));
            }
            if (r.diff.entitiesInAwsOnly.length > 0) {
              console.log(`${name} has records to delete`);
              console.dir({
                toDelete: r.diff.entitiesInAwsOnly,
              }, { depth: 4, });
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
          await lazyLoader(promiseGenerators);
          const t6 = Date.now();
          console.log(`AWS update time: ${t6 - t5}ms`);
        }
      } while(ranUpdate);
    } while (ranFullUpdate);
    const t7 = Date.now();
    res.end(`${dbname} checked and synced, total time: ${t7 - t1}ms`);
  } catch (e: any) {
    console.dir(e, { depth: 6, });
    res.status(500).end(`failure to check DB: ${e?.message ?? ''}`);
  } finally {
    orm?.dropConn();
  }
});
