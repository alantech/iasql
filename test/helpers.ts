import { execSync } from 'child_process';
import fs from 'fs';
import { createConnection } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import logger from '../src/services/logger';
import MetadataRepo from '../src/services/repositories/metadata';

export async function execComposeUp() {
  execSync('cd test && docker-compose up -d && sleep 5');
  await MetadataRepo.init();
}

export async function execComposeDown() {
  //execSync('cd test && docker-compose down');
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

export function runApply(dbAlias: string) {
  return runQuery(dbAlias, 'select iasql_apply();');
}

export function runSync(dbAlias: string) {
  return runQuery(dbAlias, 'select iasql_sync();');
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
) {
  return function (done: (e?: any) => {}) {
    if (log) logger.info(queryString);
    createConnection({
      name: uuidv4(),
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'localhost',
      port: 5432,
      database: databaseName,
      extra: { ssl: false },
    }).then(conn => {
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
  let stdoutKey;
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
