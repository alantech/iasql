import * as fs from 'fs'
import { inspect, } from 'util'
import * as express from 'express'
import { createConnection, Connection, EntityTarget, } from 'typeorm'

import { AWS, } from '../services/gateways/aws'
import config from '../config'
import { TypeormWrapper, } from '../services/typeorm'
import * as Entities from '../entity'
import * as Mappers from '../mapper'
import { IndexedAWS, } from '../services/indexed-aws'
import { findDiff, } from '../services/diff'
import { Source, getSourceOfTruth, } from '../services/source-of-truth'
import { getAwsPrimaryKey, } from '../services/aws-primary-key'
import { lazyLoader, } from '../services/lazy-dep'

export const db = express.Router();

// We only want to do this setup once, then we re-use it. First we get the list of files
const migrationFiles = fs
  .readdirSync(`${__dirname}/../migration`)
  .filter(f => !/\.map$/.test(f));
// Then we construct the class names stored within those files (assuming *all* were generated with
// `yarn gen-sql some-name`
const migrationNames = migrationFiles.map(f => {
  const components = f.replace(/\.js/, '').split('-');
  const tz = components.shift();
  for (let i = 1; i < components.length; i++) {
    components[i] = components[i].replace(/^([a-z])(.*$)/, (_, p1, p2) => p1.toUpperCase() + p2);
  }
  return [...components, tz].join('');
});
// Then we dynamically `require` the migration files and construct the inner classes
const migrationObjs = migrationFiles
  .map(f => require(`../migration/${f}`))
  .map((c, i) => c[migrationNames[i]])
  .map(M => new M());
// Finally we use this in this function to execute all of the migrations in order for a provided
// connection, but without the migration management metadata being added, which is actually a plus
// for us.
async function migrate(conn: Connection) {
  const qr = conn.createQueryRunner();
  await qr.connect();
  for (const m of migrationObjs) {
    await m.up(qr);
  }
  await qr.release();
}

async function populate(awsClient: AWS, indexes: IndexedAWS, source?: Source) {
  const promiseGenerators = Object.values(Mappers)
    .filter(mapper => {
      let out = mapper instanceof Mappers.EntityMapper;
      if (out && typeof source === 'string') {
        out &&= getSourceOfTruth((mapper as Mappers.EntityMapper).getEntity()) === source;
      }
      return out;
    })
    .map(mapper => () => (mapper as Mappers.EntityMapper).readAWS(awsClient, indexes));
  await lazyLoader(promiseGenerators);
}

async function saveEntities(
  orm: TypeormWrapper,
  awsClient: AWS,
  indexes: IndexedAWS,
  entity: Function,
  mapper: Mappers.EntityMapper,
) {
  const t1 = Date.now();
  const entities = await indexes.toEntityList(mapper, awsClient);
  await orm.save(entity, entities);
  const t2 = Date.now();
  console.log(`${entity.name} stored in ${t2 - t1}ms`);
}

db.get('/create/:db', async (req, res) => {
  const t1 = Date.now();
  const dbname = req.params.db;
  let conn1, conn2;
  let orm: TypeormWrapper | undefined;
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
    const awsClient = new AWS({
      region: config.region ?? 'eu-west-1',
      credentials: {
        accessKeyId: config.accessKeyId ?? '',
        secretAccessKey: config.secretAccessKey ?? '',
      },
    });
    const indexes = new IndexedAWS();
    const t2 = Date.now();
    console.log(`Start populating index after ${t2 - t1}ms`)
    await populate(awsClient, indexes);
    const t3 = Date.now();
    console.log(`Populate indexes in ${t3 - t2}ms`)
    // TODO: Put this somewhere else
    orm = await TypeormWrapper.createConn(dbname);
    const o: TypeormWrapper = orm;
    console.log(`Populating new db: ${dbname}`);
    const mappers: Mappers.EntityMapper[] = Object.values(Mappers)
      .filter(m => m instanceof Mappers.EntityMapper) as Mappers.EntityMapper[];
    await lazyLoader(mappers.map(m => () => saveEntities(o, awsClient, indexes, m.getEntity(), m)));
    const t4 = Date.now();
    console.log(`Writing complete in ${t4 - t3}ms`);
    res.end(`create ${dbname}: ${JSON.stringify(resp1)}`);
  } catch (e: any) {
    console.log(`failure to create DB: ${e?.message ?? ''}\n${e?.stack ?? ''}\n${e?.failures ?? ''}`);
    res.status(500).end(`failure to create DB: ${e?.message ?? ''}\n${e?.stack ?? ''}`);
  } finally {
    await conn1?.close();
    await conn2?.close();
    await orm?.dropConn();
  }
});

db.get('/delete/:db', async (req, res) => {
  const dbname = req.params.db;
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

db.get('/check/:db', async (req, res) => {
  const dbname = req.params.db;
  const t1 = Date.now();
  console.log(`Checking ${dbname}`);
  let orm: TypeormWrapper | null = null;
  try {
    orm = await TypeormWrapper.createConn(dbname);
    const awsClient = new AWS({
      region: config.region ?? 'eu-west-1',
      credentials: {
        accessKeyId: config.accessKeyId ?? '',
        secretAccessKey: config.secretAccessKey ?? '',
      },
    });
    const indexes = new IndexedAWS();
    const t2 = Date.now();
    console.log(`Setup took ${t2 - t1}ms`);
    let ranFullUpdate = false;
    await populate(awsClient, indexes, Source.DB);
    do {
      ranFullUpdate = false;
      const t3 = Date.now();
      console.log(`AWS record acquisition time: ${t3 - t2}ms`);
      const tables = Object.keys(indexes.get());
      const mappers = tables.map(t => (Mappers as any)[t + 'Mapper']);
      const dbEntities = await Promise.all(tables.map(t => orm?.find((Entities as any)[t])));
      const comparisonKeys = tables.map(t => getAwsPrimaryKey((Entities as any)[t]));
      const t4 = Date.now();
      console.log(`DB Mapping time: ${t4 - t3}ms`);
      let ranUpdate = false;
      do {
        const ta = Date.now();
        ranUpdate = false;
        indexes.flush();
        await populate(awsClient, indexes, Source.DB);
        const awsEntities = await Promise.all(tables.map(t => indexes.toEntityList(
          (Mappers as any)[t + 'Mapper'],
          awsClient,
        )));
        const records = colToRow({
          table: tables,
          mapper: mappers,
          dbEntity: dbEntities,
          awsEntity: awsEntities,
          comparisonKey: comparisonKeys,
        });
        const tb = Date.now();
        console.log(`AWS Mapping time: ${tb - ta}ms`);
        records.forEach(r => {
          r.diff = findDiff(r.table, r.dbEntity, r.awsEntity, r.comparisonKey);
        });
        const t5 = Date.now();
        console.log(`Diff time: ${t5 - tb}ms`);
        const promiseGenerators = records
          .filter(r => ['SecurityGroup', 'Instance', 'RDS'].includes(r.table)) // TODO: Don't do this
          .map(r => {
            const name = r.table;
            console.log(`Checking ${name}`);
            const outArr = [];
            if (r.diff.entitiesInDbOnly.length > 0) {
              console.log(`${name} has records to create`);
              outArr.push(r.diff.entitiesInDbOnly.map((e: any) => async () => {
                await orm?.save(r.mapper.getEntity(), await r.mapper.createAWS(e, awsClient, indexes));
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
                console.log(`${inspect(r.diff, true, 6)}`)
                console.log(`${JSON.stringify(r.diff)}`)
                outArr.push(async () => {
                  await r.mapper.updateAWS(entity, awsClient, indexes)
                });
              }
            });
            if (diffFound) console.log(`${name} has records to update`);
            if (r.diff.entitiesInAwsOnly.length > 0) {
              console.log(`${name} has records to delete`);
              outArr.push(r.diff.entitiesInAwsOnly.map((e: any) => async () => {
                await r.mapper.deleteAWS(e, awsClient, indexes);
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

// Test endpoint to ensure all ORM queries to entities work as expected
db.get('/find/:db', async (req, res) => {
  const dbname = req.params.db;
  const t1 = Date.now();
  console.log(`Find entities in ${dbname}`);
  let orm: TypeormWrapper | null = null;
  try {
    orm = await TypeormWrapper.createConn(dbname);
    const t2 = Date.now();
    console.log(`Setup took ${t2 - t1}ms`);
    const finds = [];
    for (const e of Object.values(Entities)) {
      if (typeof e === 'function') {
        finds.push(orm?.find(e as EntityTarget<any>));
      }
    };
    await Promise.all(finds);
    const t3 = Date.now();
    console.log(`Find time: ${t3 - t2}ms`);
    res.end('ok');
  } catch (e: any) {
    console.error(e);
    res.status(500).end(`failure to find all entities in DB: ${e?.message ?? ''}`);
  } finally {
    orm?.dropConn();
  }
});
