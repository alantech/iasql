// Currently just a collection of independent functions for user database management. May eventually
// grow into something more.

import * as fs from 'fs'

import { Connection, } from 'typeorm'

import * as Mappers from '../mapper'
import { AWS, } from './gateways/aws'
import { IndexedAWS, } from './indexed-aws'
import { Source, getSourceOfTruth, } from './source-of-truth'
import { lazyLoader, } from './lazy-dep'

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
export async function migrate(conn: Connection) {
  const qr = conn.createQueryRunner();
  await qr.connect();
  for (const m of migrationObjs) {
    await m.up(qr);
  }
  await qr.release();
}

export async function populate(awsClient: AWS, indexes: IndexedAWS, source?: Source) {
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

