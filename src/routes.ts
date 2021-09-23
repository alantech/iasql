import * as express from 'express'
import * as fs from 'fs'
import { createConnection, Connection, } from 'typeorm'

import { AWS } from './services/gateways/aws'
import config from './config'
import { aws } from './router/aws'
import { TypeormWrapper } from './services/typeorm'
import { RegionMapper } from './mapper/region'
import { inspect } from 'util'
import { Region } from './entity/region'

// We only want to do this setup once, then we re-use it. First we get the list of files
const migrationFiles = fs
  .readdirSync(`${__dirname}/migration`)
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
  .map(f => require(`./migration/${f}`))
  .map((c,i) => c[migrationNames[i]])
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

const v1 = express.Router();
v1.get('/create/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
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
    res.end(`create ${dbname}: ${JSON.stringify(resp1)}`);
  } catch (e: any) {
    res.end(`failure to create DB: ${e?.message ?? ''}`);
  } finally {
    conn1?.close();
    conn2?.close();
  }
});

v1.get('/delete/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
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
    res.end(`failure to drop DB: ${e?.message ?? ''}`);
  } finally {
    conn?.close();
  }
});

v1.get('/check/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
  let orm: TypeormWrapper | null = null;
  try {
    orm = await TypeormWrapper.createConn(dbname);
    const regions = await orm.find(Region);
    const awsClient = new AWS({ region: config.region ?? 'eu-west-1', credentials: { accessKeyId: config.accessKeyId ?? '', secretAccessKey: config.secretAccessKey ?? '' } })
    const regionsAWS = await awsClient.getRegions();
    const regionsMapped = await RegionMapper.fromAWS(regionsAWS?.Regions ?? []);
    const diff = findDiff(regions, regionsMapped, 'name');
    res.end(`
      To create: ${inspect(diff.entitiesToCreate)}
      To delete: ${inspect(diff.entitiesToDelete)}
      Differences: ${inspect(diff.entitiesDiff)}
    `);
  } catch (e: any) {
    res.end(`failure to check DB: ${e?.message ?? ''}`);
  } finally {
    orm?.dropConn();
  }
});

v1.use('/aws', aws)

export { v1 };

// TODO refactor to a class
function findDiff(dbEntities: any[], cloudEntities: any[], id: string) {
  const entitiesToCreate: any[] = [];
  const entitiesToDelete: any[] = [];
  const dbEntityIds = dbEntities.map(e => e[id]); 
  const cloudEntityIds = cloudEntities.map(e => e[id]);
  // Everything in cloud and not in db is a potential delete 
  const cloudEntNotInDb = cloudEntities.filter(e => !dbEntityIds.includes(e[id]));
  cloudEntNotInDb.map(e => entitiesToDelete.push(e));
  // Everything in db and not in cloud is a potential create 
  const dbEntNotInCloud = dbEntities.filter(e => !cloudEntityIds.includes(e[id]));
  dbEntNotInCloud.map(e => entitiesToCreate.push(e));
  // Everything else needs a diff between them
  const remainingDbEntities = dbEntities.filter(e => cloudEntityIds.includes(e[id]));
  const entitiesDiff: any[] = [];
  remainingDbEntities.map(dbEnt => {
    const cloudEntToCompare = cloudEntities.find(e => e[id] === dbEnt[id]);
    entitiesDiff.push(diff(dbEnt, cloudEntToCompare));
  });
  return {
    entitiesToCreate,
    entitiesToDelete,
    entitiesDiff
  }
}

function diff(dbObj: any, cloudObj: any) {
  if (isValue(dbObj) || isValue(cloudObj)) {
    return {
      type: compare(dbObj, cloudObj),
      db: dbObj,
      cloud: cloudObj
    };
  }
  let diffObj: any = {};
  for (let key in dbObj) {
    // Ignore database internal primary key
    if (key === 'id') {
      continue;
    }
    let cloudVal = cloudObj[key];
    diffObj[key] = diff(dbObj[key], cloudVal);
  }
  for (var key in cloudObj) {
    if (key === 'id' || diffObj[key] !== undefined) {
      continue;
    }
    diffObj[key] = diff(undefined, cloudObj[key]);
  }
  return diffObj;
}

function isValue(o: any) {
  return !isObject(o) && !isArray(o);
}

function isObject(o: any) {
  return typeof o === 'object' && o !== null && !Array.isArray(o);
}

function isArray(o: any) {
  return Array.isArray(o);
}

function isDate(o: any) {
  return o instanceof Date;
}

function compare(dbVal: any, cloudVal: any) {
  if (dbVal === cloudVal) {
    return 'unchanged'
  } 
  if (isDate(dbVal) && isDate(cloudVal) && dbVal.getTime() === cloudVal.getTime()) {
    return 'unchanged'
  }
  return `to update ${cloudVal} with ${dbVal}`
}