import * as fs from 'fs'
import { inspect, } from 'util'
import * as express from 'express'
import { createConnection, Connection, } from 'typeorm'

import { AWS, } from '../services/gateways/aws'
import config from '../config'
import { TypeormWrapper, } from '../services/typeorm'
import { AMI, BootMode, CPUArchitecture, DeviceType, InstanceType, ProductCode, Region, SecurityGroup, SecurityGroupRule, StateReason, UsageClass, VirtualizationType, } from '../entity'
import { AMIMapper, BootModeMapper, CPUArchitectureMapper, DeviceTypeMapper, InstanceTypeMapper, ProductCodeMapper, RegionMapper, SecurityGroupMapper, SecurityGroupRuleMapper, StateReasonMapper, UsageClassMapper, VirtualizationTypeMapper, } from '../mapper'
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

db.get('/create/:db', async (req, res) => {
  const t1 = new Date();
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
    const t2 = new Date();
    console.log(`Start populating index after: ${t2.getTime() - t1.getTime()}`)
    await indexes.populate(awsClient);
    const t3 = new Date();
    console.log(`Populate indexes in: ${t3.getTime() - t2.getTime()}`)
    // TODO: Put this somewhere else
    orm = await TypeormWrapper.createConn(dbname);
    console.log(`Populating new db: ${dbname}`);
    await Promise.all([(async () => {
      const regions = await indexes.toEntityList('regions', RegionMapper);
      await Promise.all(regions.map(r => orm?.save(Region, r)));
    })(), (async () => {
      const securityGroups = await indexes.toEntityList('securityGroups', SecurityGroupMapper);
      await Promise.all(securityGroups.map(sg => orm?.save(SecurityGroup, sg)));
      // The security group rules *must* be added after the security groups
      const securityGroupRules = await indexes.toEntityList(
        'securityGroupRules',
        SecurityGroupRuleMapper,
      );
      await Promise.all(securityGroupRules.map(sgr => orm?.save(SecurityGroupRule, sgr)));
    })(), (async () => {
      const arch = await indexes.toEntityList('cpuArchitectures', CPUArchitectureMapper);
      await orm.save(CPUArchitecture, arch);
      const productCodes = await indexes.toEntityList('productCodes', ProductCodeMapper);
      await orm.save(ProductCode, productCodes);
      const stateReason = await indexes.toEntityList('stateReason', StateReasonMapper);
      await orm.save(StateReason, stateReason);
      const bootMode = await indexes.toEntityList('bootMode', BootModeMapper);
      await orm.save(BootMode, bootMode);
      const amis = await indexes.toEntityList('amis', AMIMapper);
      await orm?.save(AMI, amis);
    })(),
    (async () => {
      const usageClasses = await indexes.toEntityList('usageClasses', UsageClassMapper);
      await orm.save(UsageClass, usageClasses);
      const deviceTypes = await indexes.toEntityList('supportedRootDeviceTypes', DeviceTypeMapper);
      await orm.save(DeviceType, deviceTypes);
      const virtualizationTypes = await indexes.toEntityList('supportedVirtualizationTypes', VirtualizationTypeMapper);
      await orm.save(VirtualizationType, virtualizationTypes);
      const instanceTypes = await indexes.toEntityList('instanceTypes', InstanceTypeMapper);
      await orm?.save(InstanceType, instanceTypes);
    })()
    ]);
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
  let orm: TypeormWrapper | null = null;
  try {
    orm = await TypeormWrapper.createConn(dbname);
    const regions = await orm.find(Region);
    const awsClient = new AWS({
      region: config.region ?? 'eu-west-1',
      credentials: {
        accessKeyId: config.accessKeyId ?? '',
        secretAccessKey: config.secretAccessKey ?? '',
      },
    });
    const indexes = new IndexedAWS();
    await indexes.populate(awsClient);
    const regionEntities = await indexes.toEntityList('regions', RegionMapper);
    const diff = findDiff(regions, regionEntities, 'name');
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
