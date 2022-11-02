import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getKeyCertPair,
  getPrefix,
  runApply,
  runInstall,
  runQuery,
  runSync,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'acmimporttest';
const domainName = `${prefix}${dbAlias}.com`;
const [key, cert] = getKeyCertPair(domainName);

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_acm'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('AwsAcm Import Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.connect(
    dbAlias,
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the aws_account module', install(['aws_account']));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `));

  it('installs the acm module', install(modules));

  it('adds a new certificate to import', query(`
    SELECT * FROM certificate_import('${cert}', '${key}', '${region}', '');
  `));

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

  it('import a certificate in non-default region', query(`
    SELECT * FROM certificate_import('${cert}', '${key}', '${region}', '');
  `));

  it('verifies the certificate in the non-default region is created', query(`
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `, (res: any) => expect(res.length).toBe(1)));

  it('deletes the certificate in non-default region', query(`
    DELETE FROM certificate;
  `));

  it('applies the deletion of the certificate in the non-default region', apply());

  it('deletes the test db', (done) => void iasql
    .disconnect(dbAlias, 'not-needed')
    .then(...finish(done)));
});
