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

async function saveEntities(orm: TypeormWrapper, indexes: IndexedAWS, entity: Function, mapper: Mappers.EntityMapper) {
  const t1 = Date.now();
  const entities = indexes.toEntityList(mapper);
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
    if (!config.accessKeyId) throw new Error('noo credentials');
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
    console.log(`Populating new db: ${dbname}`);
    await Promise.all([
      (async () => {
        await saveEntities(orm, indexes, Entities.Region, Mappers.RegionMapper);
        await saveEntities(orm, indexes, Entities.AvailabilityZone, Mappers.AvailabilityZoneMapper);
      })(),
      (async () => {
        await saveEntities(orm, indexes, Entities.SecurityGroup, Mappers.SecurityGroupMapper);
        // The security group rules *must* be added after the security groups
        await saveEntities(orm, indexes, Entities.SecurityGroupRule, Mappers.SecurityGroupRuleMapper)
      })(),
      (async () => {
        await Promise.all([
          saveEntities(orm, indexes, Entities.CPUArchitecture, Mappers.CPUArchitectureMapper),
          saveEntities(orm, indexes, Entities.ProductCode, Mappers.ProductCodeMapper),
          saveEntities(orm, indexes, Entities.StateReason, Mappers.StateReasonMapper),
          saveEntities(orm, indexes, Entities.BootMode, Mappers.BootModeMapper),
        ]);
        await saveEntities(orm, indexes, Entities.AMI, Mappers.AMIMapper);
      })(),
      (async () => {
        await Promise.all([
          saveEntities(orm, indexes, Entities.UsageClass, Mappers.UsageClassMapper),
          saveEntities(orm, indexes, Entities.DeviceType, Mappers.DeviceTypeMapper),
          saveEntities(orm, indexes, Entities.VirtualizationType, Mappers.VirtualizationTypeMapper),
          saveEntities(orm, indexes, Entities.PlacementGroupStrategy, Mappers.PlacementGroupStrategyMapper),
          saveEntities(orm, indexes, Entities.ValidCore, Mappers.ValidCoreMapper),
          saveEntities(orm, indexes, Entities.ValidThreadsPerCore, Mappers.ValidThreadsPerCoreMapper),
          saveEntities(orm, indexes, Entities.InstanceTypeValue, Mappers.InstanceTypeValueMapper),
        ]);
        await saveEntities(orm, indexes, Entities.InstanceType, Mappers.InstanceTypeMapper)
      })(),
    ]);
    const t4 = Date.now();
    console.log(`Writing complete in ${t4 - t3}ms`);
    res.end(`create ${dbname}: ${JSON.stringify(resp1)}`);
  } catch (e: any) {
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
    await populate(awsClient, indexes, Source.DB);
    const t3 = Date.now();
    console.log(`AWS record acquisition time: ${t3 - t2}ms`);
    const tables = Object.keys(indexes.get());
    const mappers = tables.map(t => (Mappers as any)[t + 'Mapper']);
    const dbEntities = await Promise.all(tables.map(t => orm?.find((Entities as any)[t])));
    const awsEntities = tables.map(t => indexes.toEntityList((Mappers as any)[t + 'Mapper']));
    const comparisonKeys = tables.map(t => getAwsPrimaryKey((Entities as any)[t]));
    const t4 = Date.now();
    console.log(`Mapping time: ${t4 - t3}ms`);
    const diffs = dbEntities.map((d, i) => findDiff(tables[i], d, awsEntities[i], comparisonKeys[i]));
    const t5 = Date.now();
    console.log(`Diff time: ${t5 - t4}ms`);
    await Promise.all(mappers.map(async (m, i) => {
      const ta = Date.now();
      const name = m.getEntity().name;
      console.log(`Checking ${name}`);
      if (!['Instance', 'SecurityGroup'].includes(m.getEntity().name)) return; // TODO: Don't do this
      const diff = diffs[i];
      if (diff.entitiesInDbOnly.length > 0) {
        console.log(`${name} has records to create`);
        await Promise.all(diff.entitiesInDbOnly.map(async (e) => {
          // Mutate in AWS, it also updates the entity for us with any AWS-created prop values
          await orm?.save(m. getEntity(), await m.createAWS(e, awsClient, indexes));
        }));
      }
      const tb = Date.now();
      console.log(`${name} took ${tb - ta}ms`);
    }));
    const t6 = Date.now();
    console.log(`AWS update time: ${t6 - t5}ms`);
    res.end(`${inspect(diffs, { depth: 4, })}`);
  } catch (e: any) {
    console.error(e);
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
