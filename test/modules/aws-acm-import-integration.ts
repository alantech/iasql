import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runApply, finish, execComposeUp, execComposeDown, runSync, runInstall, runUninstall } from '../helpers'
import { execSync } from 'child_process'

const prefix = getPrefix();
const dbAlias = 'acmimporttest';
const domainName = `${prefix}${dbAlias}.com`;
const stdoutCert = execSync(
  `openssl req -x509 -new -nodes -days 1 -newkey rsa:2048 -outform PEM \
  -subj "/C=US/ST=test/L=test/O=test LLC/OU=devops/CN=${domainName}" | cat`,
  { shell: '/bin/bash', encoding: 'utf-8'}
);
const certBeginTag = '-----BEGIN CERTIFICATE-----';
const certEndTag = '-----END CERTIFICATE-----';
const cert = stdoutCert.substring(stdoutCert.indexOf(certBeginTag), stdoutCert.lastIndexOf(certEndTag) + certEndTag.length);

const stdoutKey = execSync(
  `cat privkey.pem`,
  { shell: '/bin/bash', encoding: 'utf-8'}
);
const keyBeginTag = '-----BEGIN PRIVATE KEY-----';
const keyEndTag = '-----END PRIVATE KEY-----';
const key = stdoutKey.substring(stdoutKey.indexOf(keyBeginTag), stdoutKey.lastIndexOf(keyEndTag) + keyEndTag.length);

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_acm_list', 'aws_acm_import'];

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('AwsAcmImport Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_REGION}', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the acm_import module', install(modules));

  it('adds a new certificate to import', query(`
    INSERT INTO certificate_import (body, private_key)
    VALUES ('${cert}', '${key}');
  `));

  it('sync before apply (should restore)', sync());

  it('check no new certificate to import', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(0)));
    
  it('adds a new certificate to import', query(`
    INSERT INTO certificate_import (body, private_key)
    VALUES ('${cert}', '${key}');
  `));

  it('check adds new certificate to import', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('applies the new certificate import', apply());

  it('check import row delete', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check new certificate added', query(`
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('uninstalls modules', uninstall(modules));

  it('installs modules', install(modules));

  it('check certificate count after uninstall/install', query(`
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('check certificate import count after uninstall/install', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes a certificate imported', query(`
    DELETE FROM certificate
    WHERE domain_name = '${domainName}';
  `));

  it('applies the delete', apply());

  it('check certificate count after delete', query(`
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('AwsAcmImport install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_account (region, access_key_id, secret_access_key)
    VALUES ('us-east-1', '${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `));

  it('installs the modules', install(modules));

  it('uninstalls the module', uninstall(modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    'postgres',
    true).then(...finish(done)));

  it('uninstalls the import module', uninstall(['aws_acm_import']));

  it('installs the module', install(['aws_acm_import']));

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
