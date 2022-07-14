import * as iasql from '../../src/services/iasql'
import {
  getPrefix,
  runQuery,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
  runInstall,
  runUninstall,
  getKeyCertPair,
} from '../helpers'

const prefix = getPrefix();
const dbAlias = 'acmimporttest';
const domainName = `${prefix}${dbAlias}.com`;
const [key, cert] = getKeyCertPair(domainName);

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_acm_list', 'aws_acm_import'];

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown()));

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
    INSERT INTO certificate_import (certificate, private_key)
    VALUES ('${cert}', '${key}');
  `));

  it('sync before apply (should restore)', sync());

  it('check no new certificate to import', query(`
    SELECT *
    FROM certificate_import;
  `, (res: any[]) => expect(res.length).toBe(0)));
    
  it('adds a new certificate to import', query(`
    INSERT INTO certificate_import (certificate, private_key)
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
