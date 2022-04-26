import { execSync, } from 'child_process'
import fs from 'fs'

import { createConnection, } from 'typeorm'
import config from '../src/config';

import * as iasql from '../src/services/iasql'
import MetadataRepo from '../src/services/repositories/metadata'
import logger from '../src/services/logger'

export async function execComposeUp() {
  execSync('cd test && docker-compose up -d && sleep 5');
  await MetadataRepo.init();
}

export async function execComposeDown(modules?: string[], region?: string) {
  if (modules?.length) await cleanDB(modules, region);
  execSync('cd test && docker-compose down');
}

export function getPrefix(){
  const lowerCaseLetters = Array(26).fill('a').map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const digits = Array(10).fill('0').map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const chars = [ lowerCaseLetters, digits, ].flat();
  const randChar = (): string => chars[Math.floor(Math.random() * chars.length)];
  const randLetter = (): string => lowerCaseLetters[Math.floor(Math.random() * lowerCaseLetters.length)];
  return randLetter() + Array(6).fill('').map(() => randChar()).join('');
}

export function finish(done: (e?: any) => {}) {
  return [() => done(), (e: any) => { done(e); }];
}

export function runApply(dbAlias: string) {
  return runQuery(dbAlias, 'select iasql_apply();');
}

export function runSync(dbAlias: string) {
  return runQuery(dbAlias, 'select iasql_sync();');
}

export function runInstall(dbAlias: string, mods: string[]) {
  return runQuery(dbAlias, `select iasql_install(${mods.map(m => `'${m}'`)});`);
}

export function runUninstall(dbAlias: string, mods: string[]) {
  return runQuery(dbAlias, `select iasql_uninstall(${mods.map(m => `'${m}'`)});`);
}

export function runQuery(databaseName: string, queryString: string, assertFn?: (res: any[]) => void) {
  return function (done: (e?: any) => {}) {
    logger.info(queryString);
    createConnection({
      name: `${databaseName}-conn`,
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'localhost',
      port: 5432,
      database: databaseName,
      extra: { ssl: false, },
    }).then((conn) => {
      conn.query(queryString).then((res: any[]) => {
        conn.close().then(...finish((_e?: any) => {
          if (assertFn) {
            try {
              assertFn(res);
            } catch (e: any) {
              done(e);
              return {};
            }
          }
          done();
          return {};
        }));
      }, (e) => {
        conn.close().then(() => done(e), (e2) => done(e2));
      });
    }, done);
  }
}

async function cleanDB(modules: string[], region: string | undefined): Promise<void> {
  const dbAlias = `cleandb${Date.now()}`;
  const awsRegion = region ?? process.env.AWS_REGION ?? 'barf';
  logger.info(`Cleaning ${dbAlias} in ${awsRegion}...`);
  await iasql.connect(dbAlias, 'not-needed', 'not-needed');
  logger.info('DB created...');
  await iasql.install(['aws_account@0.0.1'], dbAlias, config.db.user);
  const conn = await createConnection({
    name: dbAlias,
    type: 'postgres',
    username: 'postgres',
    password: 'test',
    host: 'localhost',
    port: 5432,
    database: dbAlias,
    extra: { ssl: false, },
  });
  logger.info(`Connection created...`);
  await conn.query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${awsRegion}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `);
  logger.info('AWS Account set up');
  await iasql.install(modules, dbAlias, config.db.user);
  logger.info(`Modules ${modules.join(', ')} installed...`);
  const delQuery = fs.readFileSync(`${__dirname}/sql/delete_records.sql`, 'utf8');
  logger.info(delQuery);
  await conn.query(delQuery);
  await conn.close();
  const res = await iasql.apply(dbAlias, false);
  logger.info('Deletes applied...');
  logger.info('', res as any);
  await iasql.disconnect(dbAlias, 'not-needed');
  logger.info('DB removed...');
}
