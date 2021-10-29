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

/*async function saveEntities(
  orm: TypeormWrapper,
  awsClient: AWS,
  indexes: IndexedAWS,
  mapper: Mappers.EntityMapper,
) {
  const t1 = Date.now();
  const entity = mapper.getEntity();
  const entities = await indexes.toEntityList(mapper, awsClient);
  await orm.save(entity, entities);
  const t2 = Date.now();
  console.log(`${entity.name} stored in ${t2 - t1}ms`);
}*/

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
  //let orm: TypeormWrapper | undefined;
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
    // TODO: The following commented code is part of the "initialization" logic for the various
    // entities, and should be refactored to be part of the module "install" process. Maybe it
    // just belongs as part of the `post-install` script and just a pattern within the modules
    // instead of being fully centralized? For now it is commented out and left where it used to be.
    /*
    const awsClient = new AWS({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
    const indexes = new IndexedAWS();
    const t2 = Date.now();
    console.log(`Start populating index after ${t2 - t1}ms`)
    await populate(awsClient, indexes);
    const t3 = Date.now();
    console.log(`Populate indexes in ${t3 - t2}ms`)
    // TODO: Put this somewhere else
    const o: TypeormWrapper = orm;
    console.log(`Populating new db: ${dbname}`);
    const mappers: Mappers.EntityMapper[] = Object.values(Mappers)
      .filter(m => m instanceof Mappers.EntityMapper) as Mappers.EntityMapper[];
    await lazyLoader(mappers.map(m => () => saveEntities(o, awsClient, indexes, m)));
    const t4 = Date.now();
    console.log(`Writing complete in ${t4 - t3}ms`);
    // store credentials
    const region = await orm.findOne(Entities.Region, { where: { name: awsRegion }});
    await orm.query(`
      INSERT INTO aws_credentials VALUES (DEFAULT, '${awsAccessKeyId}', '${awsSecretAccessKey}', '${region.id}');
    `);
    */
    res.end(`create ${dbname}: ${JSON.stringify(resp1)}`);
  } catch (e: any) {
    res.status(500).end(`failure to create DB: ${e?.message ?? ''}\n${e?.stack ?? ''}`);
  } finally {
    await conn1?.close();
    await conn2?.close();
    //await orm?.dropConn();
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
    console.log({
      moduleNames,
    });
    const context: Modules.Context = { orm, }; // Every module gets access to the DB
    for (let name of moduleNames) {
      const mod = Object.values(Modules).find(m => m.name === name);
      if (!mod) throw new Error(`This should be impossible. Cannot find module ${name}`);
      const moduleContext = mod.provides.context ?? {};
      Object.keys(moduleContext).forEach(k => context[k] = moduleContext[k]);
    }
    // Get the relevant mappers, which are the ones where the DB is the source-of-truth
    const mappers = Object.values(Modules)
      .filter(mod => moduleNames.includes(mod.name))
      .map(mod => Object.values(mod.mappers))
      .flat()
      .filter(mapper => mapper.source === 'db');
    /*// For now, assume `aws_account` module is installed
    const awsClient = await Modules.AwsAccount.provides.context?.getAwsClient.bind({ orm, })();
    const indexes = new IndexedAWS();*/
    const t2 = Date.now();
    console.log(`Setup took ${t2 - t1}ms`);
    let ranFullUpdate = false;
    //await populate(awsClient, indexes, 'db');
    do {
      ranFullUpdate = false;
      const tables = mappers.map(mapper => mapper.entity.name);
      const dbEntities: any[][] = [];
      await lazyLoader(mappers.map((mapper, i) => async () => {
        const entities = await mapper.db.read(context);
        dbEntities[i] = entities;
      }));
      const cloudEntities: any[][] = [];
      await lazyLoader(mappers.map((mapper, i) => async () => {
        const entities = await mapper.cloud.read(context);
        cloudEntities[i] = entities;
      }));
      const idGens = mappers.map(mapper => mapper.entityId);
      const t3 = Date.now();
      console.log(`Record acquisition time: ${t3 - t2}ms`);
      const records = colToRow({
        table: tables,
        mapper: mappers,
        dbEntity: dbEntities,
        cloudEntity: cloudEntities,
        idGen: idGens,
      });
      const t4 = Date.now();
      console.log(`AWS Mapping time: ${t4 - t3}ms`);
      records.forEach(r => {
        r.diff = findDiff(r.table, r.dbEntity, r.awsEntity, r.idGen);
      });
      const t5 = Date.now();
      console.log(`Diff time: ${t5 - t4}ms`);
      const promiseGenerators = records
        //.filter(r => ['AwsSecurityGroup'].includes(r.table)) // TODO: Don't do this
        .map(r => {
          const name = r.table;
          console.log(`Checking ${name}`);
          const outArr = [];
          if (r.diff.entitiesInDbOnly.length > 0) {
            console.log(`${name} has records to create`);
            outArr.push(r.diff.entitiesInDbOnly.map((e: any) => async () => {
              const out = await r.mapper.cloud.create(e, context);
              if (out) {
                await orm?.save(r.mapper.entity, out);
              }
            }));
          }
          let diffFound = false;
          r.diff.entitiesDiff.forEach((d: any) => {
            const valIsUnchanged = (val: any): boolean => {
              if (val.hasOwnProperty('type')) {
                return val.type === 'unchanged';
              } else if (Array.isArray(val)) {
                return val.every(v => valIsUnchanged(v));
              } else if (val instanceof Object) {
                return Object.keys(val).filter(k => k !== 'id').every(v => valIsUnchanged(val[v]));
              } else {
                return false;
              }
            };
            const unchanged = valIsUnchanged(d);
            if (!unchanged) {
              diffFound = true;
              const entity = r.dbEntity.find((e: any) => e.id === d.id);
              outArr.push(async () => {
                await r.mapper.cloud.update(entity, context);
              });
            }
          });
          if (diffFound) console.log(`${name} has records to update`);
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
        ranFullUpdate = true;
        await lazyLoader(promiseGenerators);
        const t6 = Date.now();
        console.log(`AWS update time: ${t6 - t5}ms`);
      }
    } while(ranFullUpdate);
    const t7 = Date.now();
    res.end(`${dbname} checked and synced, total time: ${t7 - t1}ms`);
  } catch (e: any) {
    console.dir(e, { depth: 6, });
    res.status(500).end(`failure to check DB: ${e?.message ?? ''}`);
  } finally {
    orm?.dropConn();
  }
});
