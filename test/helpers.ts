import { execSync } from 'child_process';
import express from 'express';
import fs from 'fs';
import { Connection } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import config from '../src/config';
import { v1 } from '../src/router';
import logger from '../src/services/logger';
import MetadataRepo from '../src/services/repositories/metadata';

const port = config.http.port;
const app = express();
app.use('/v1', v1);
let server: any;

export async function execComposeUp() {
  execSync('cd test && docker-compose up -d && sleep 5');
  await MetadataRepo.init();
  await new Promise(r => {
    server = app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
      r(undefined);
    });
  });
}

export async function execComposeDown() {
  execSync('cd test && docker-compose down');
  await new Promise(r => {
    server?.close(() => {
      logger.info('Server is shutting down');
      r(undefined);
    });
  });
}

export function getPrefix() {
  const lowerCaseLetters = Array(26)
    .fill('a')
    .map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const digits = Array(10)
    .fill('0')
    .map((c, i) => String.fromCharCode(c.charCodeAt() + i));
  const chars = [lowerCaseLetters, digits].flat();
  const randChar = (): string => chars[Math.floor(Math.random() * chars.length)];
  const randLetter = (): string => lowerCaseLetters[Math.floor(Math.random() * lowerCaseLetters.length)];
  return (
    randLetter() +
    Array(6)
      .fill('')
      .map(() => randChar())
      .join('')
  );
}

export function finish(done: (e?: any) => {}) {
  return [
    () => done(),
    (e: any) => {
      done(e);
    },
  ];
}

export function runBegin(dbAlias: string) {
  return runQuery(dbAlias, 'select iasql_begin();');
}

export function runCommit(dbAlias: string) {
  return runQuery(dbAlias, 'select iasql_commit();');
}

export function runRollback(dbAlias: string) {
  return runQuery(dbAlias, 'select iasql_rollback();');
}

export function runInstall(dbAlias: string, mods: string[]) {
  return runQuery(dbAlias, `select iasql_install(${mods.map(m => `'${m}'`)});`);
}

export function runInstallAll(dbAlias: string) {
  return runQuery(
    dbAlias,
    `select iasql_install(
    variadic array(select module_name from iasql_modules_list() where module_name != 'aws_account' and module_name not like 'iasql_%')
  );`,
  );
}

export function runUninstall(dbAlias: string, mods: string[]) {
  return runQuery(dbAlias, `select iasql_uninstall(${mods.map(m => `'${m}'`)});`);
}

export function runUninstallAll(dbAlias: string) {
  return runQuery(
    dbAlias,
    `select iasql_uninstall(
    variadic array(select module_name from iasql_modules_list() where module_name != 'aws_account' and module_name not like 'iasql_%')
  );`,
  );
}

export function runQuery(
  databaseName: string,
  queryString: string,
  assertFn?: (res: any[]) => void,
  log = true,
  withUserAndPassword = () => ({ username: config.db.user, password: config.db.password }),
  queryReplacements: () => { [key: string]: string } = () => ({}),
) {
  return function (done: (e?: any) => {}) {
    const { username, password } = withUserAndPassword();
    const replaceWith = queryReplacements();
    for (const [key, value] of Object.entries(replaceWith)) {
      queryString = queryString.replace(`##${key}##`, value);
    }
    if (log) logger.info(queryString);
    new Connection({
      name: uuidv4(),
      type: 'postgres',
      username,
      password,
      host: 'localhost',
      port: 5432,
      database: databaseName,
      extra: { ssl: false },
    })
      .connect()
      .then(conn => {
        conn.query(queryString).then(
          (res: any[]) => {
            conn.close().then(
              ...finish((_e?: any) => {
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
              }),
            );
          },
          e => {
            conn.close().then(
              () => done(e),
              e2 => done(e2),
            );
          },
        );
      }, done);
  };
}

export function getKeyCertPair(domainName: string): string[] {
  const stdoutCert = execSync(
    `openssl req -x509 -new -nodes -days 1 -newkey rsa:2048 -outform PEM \
    -subj "/C=US/ST=test/L=test/O=test LLC/OU=devops/CN=${domainName}" | cat`,
    { shell: '/bin/bash', encoding: 'utf-8' },
  );
  const certBeginTag = '-----BEGIN CERTIFICATE-----';
  const certEndTag = '-----END CERTIFICATE-----';
  const cert = stdoutCert.substring(
    stdoutCert.indexOf(certBeginTag),
    stdoutCert.lastIndexOf(certEndTag) + certEndTag.length,
  );

  // check if we have a valid content on stdout, or fallback to a file
  let stdoutKey: string;
  if (fs.existsSync('privkey.pem'))
    stdoutKey = execSync(`cat privkey.pem`, { shell: '/bin/bash', encoding: 'utf-8' });
  else stdoutKey = stdoutCert;

  const keyBeginTag = '-----BEGIN PRIVATE KEY-----';
  const keyEndTag = '-----END PRIVATE KEY-----';
  const key = stdoutKey.substring(
    stdoutKey.indexOf(keyBeginTag),
    stdoutKey.lastIndexOf(keyEndTag) + keyEndTag.length,
  );
  return [key, cert];
}

export function defaultRegion(overrideList?: string[]): string {
  const regionList = overrideList ?? [
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-northeast-3',
    'ap-south-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ca-central-1',
    'eu-central-1',
    'eu-north-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'sa-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
  ];
  return regionList[Math.floor(Math.random() * regionList.length)];
}

export function itDocs(...args: any[]): any {
  return (it as unknown as (...args: any[]) => {})(...args);
}
