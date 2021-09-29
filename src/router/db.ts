import * as fs from 'fs'
import { inspect, } from 'util'

import {
  Region as RegionAWS,
  SecurityGroup as SecurityGroupAWS,
  SecurityGroupRule as SecurityGroupRuleAWS,
  Image,
} from '@aws-sdk/client-ec2'
import * as express from 'express'
import { createConnection, Connection, } from 'typeorm'

import { AWS, } from '../services/gateways/aws'
import config from '../config'
import { TypeormWrapper, } from '../services/typeorm'
import * as Entities from '../entity'
import * as Mappers from '../mapper'
import { IndexedAWS, } from '../services/indexed-aws'
import { findDiff, } from '../services/diff'

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

async function populate(awsClient: AWS, indexes: IndexedAWS) {
  const populator = async (entity: Function, awsMethod: string, awsArr: string, idProp: string) => {
    const t1 = Date.now();
    console.log(`Populating ${entity.name}...`);
    const entitiesAws = await (awsClient as unknown as { [key: string]: Function })[awsMethod]();
    console.log(`Querying AWS for ${entity.name} complete...`);
    for (const entityAws of (entitiesAws[awsArr] ?? [])) {
      indexes.set(entity, entityAws[idProp] ?? '', entityAws);
    }
    const t2 = Date.now();
    console.log(`${entity.name} complete in ${t2 - t1}ms`);
  }
  await Promise.all([
    Mappers.RegionMapper.readAWS(awsClient, indexes),
    populator(Entities.SecurityGroup, 'getSecurityGroups', 'SecurityGroups', 'GroupId'),
    populator(
      Entities.SecurityGroupRule,
      'getSecurityGroupRules',
      'SecurityGroupRules',
      'SecurityGroupRuleId',
    ),
    populator(Entities.AMI, 'getAMIs', 'Images', 'ImageId'),
  ]);
  setAuxAmiIndexes(indexes);
}

function setAuxAmiIndexes(indexes: IndexedAWS) {
  const amis: { [key: string]: Image } = indexes.get(Entities.AMI);
  for (const [_id, ami] of Object.entries(amis)) {
    if (ami.Architecture) {
      indexes.set(Entities.CPUArchitecture, ami.Architecture, ami.Architecture);
    }
    if (ami.ProductCodes && ami.ProductCodes.length) {
      for (const pc of ami.ProductCodes) {
        if (pc.ProductCodeId) {
          indexes.set(Entities.ProductCode, pc.ProductCodeId, pc);
        } else {
          throw Error('productCodes is this possible?');
        }
      }
    }
    if (ami.StateReason) {
      if (ami.StateReason.Code) {
        indexes.set(Entities.StateReason, ami.StateReason.Code, ami.StateReason);
      } else {
        throw Error('stateReason is this possible?')
      }
    }
    if (ami.BootMode) {
      indexes.set(Entities.BootMode, ami.BootMode, ami.BootMode);
    }
  }
}

db.get('/create/:db', async (req, res) => {
  const t1 = Date.now();
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
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
    console.log(`Populating new db: ${dbname}`);
    await Promise.all([(async () => {
      const ta = Date.now();
      const regions = await indexes.toEntityList(Mappers.RegionMapper);
      await orm.save(Entities.Region, regions);
      const tb = Date.now();
      console.log(`Regions stored in ${tb - ta}ms`);
    })(), (async () => {
      const tc = Date.now();
      const securityGroups = await indexes.toEntityList(Mappers.SecurityGroupMapper);
      await orm.save(Entities.SecurityGroup, securityGroups);
      const td = Date.now();
      console.log(`Security groups stored in ${td - tc}ms`);
      // The security group rules *must* be added after the security groups
      const securityGroupRules = await indexes.toEntityList(Mappers.SecurityGroupRuleMapper);
      await orm.save(Entities.SecurityGroupRule, securityGroupRules);
      const te = Date.now();
      console.log(`Security group rules stored in ${te - td}ms`);
    })(), (async () => {
      await Promise.all([(async () => {
        const tf = Date.now();
        const arch = indexes.toEntityList(Mappers.CPUArchitectureMapper);
        await orm.save(Entities.CPUArchitecture, arch);
        const tg = Date.now();
        console.log(`CPU Archs stored in ${tg - tf}ms`);
      })(), (async () => {
        const th = Date.now();
        const productCodes = indexes.toEntityList(Mappers.ProductCodeMapper);
        await orm.save(Entities.ProductCode, productCodes);
        const ti = Date.now();
        console.log(`Product codes stored in ${ti - th}ms`);
      })(), (async () => {
        const tj = Date.now();
        const stateReason = indexes.toEntityList(Mappers.StateReasonMapper);
        await orm.save(Entities.StateReason, stateReason);
        const tk = Date.now();
        console.log(`State reason stored in ${tk - tj}ms`);
      })(), (async () => {
        const tl = Date.now();
        const bootMode = indexes.toEntityList(Mappers.BootModeMapper);
        await orm.save(Entities.BootMode, bootMode);
        const tm = Date.now();
        console.log(`Boot mode stored in ${tm - tl}ms`);
      })()]);
      const tn = Date.now();
      const amis = indexes.toEntityList(Mappers.AMIMapper);
      await orm.save(Entities.AMI, amis);
      const to = Date.now();
      console.log(`AMIs stored in ${to - tn}ms`);
    })(),]);
    const t4 = Date.now();
    console.log(`Writing complete in ${t4 - t3}ms`);
    res.end(`create ${dbname}: ${JSON.stringify(resp1)}`);
  } catch (e: any) {
    res.end(`failure to create DB: ${e?.message ?? ''}\n${e?.stack ?? ''}`);
  } finally {
    await conn1?.close();
    await conn2?.close();
    await orm?.dropConn();
  }
});

db.get('/delete/:db', async (req, res) => {
  console.log('delete')
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

db.get('/check/:db', async (req, res) => {
  // TODO: Clean/validate this input
  const dbname = req.params['db'];
  const t1 = new Date().getTime();
  console.log(`Checking ${dbname}`);
  let orm: TypeormWrapper | null = null;
  try {
    orm = await TypeormWrapper.createConn(dbname);
    const regions = await orm.find(Entities.Region);
    const awsClient = new AWS({
      region: config.region ?? 'eu-west-1',
      credentials: {
        accessKeyId: config.accessKeyId ?? '',
        secretAccessKey: config.secretAccessKey ?? '',
      },
    });
    const indexes = new IndexedAWS();
    const t2 = new Date().getTime();
    console.log(`Setup took ${t2 - t1}ms`);
    await populate(awsClient, indexes);
    const t3 = new Date().getTime();
    console.log(`AWS record acquisition time: ${t3 - t2}ms`);
    const regionEntities = indexes.toEntityList(Mappers.RegionMapper);
    const t4 = new Date().getTime();
    console.log(`Mapping time: ${t4 - t3}ms`);
    const diff = findDiff(regions,regionEntities, 'name');
    const t5 = new Date().getTime();
    console.log(`Diff time: ${t5 - t4}ms`);
    res.end(`
      DB Only: ${inspect(diff.entitiesInDbOnly)}
      AWS Only: ${inspect(diff.entitiesInAwsOnly)}
      Differences: ${inspect(diff.entitiesDiff)}
    `);
  } catch (e: any) {
    res.end(`failure to check DB: ${e?.message ?? ''}`);
  } finally {
    orm?.dropConn();
  }
});
