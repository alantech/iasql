import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getKeyCertPair,
  getPrefix,
  runCommit,
  runInstall,
  runQuery,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'acmimporttest';
const domainName = `${prefix}${dbAlias}.com`;
const [key, cert] = getKeyCertPair(domainName);

const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_acm'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('AwsAcm Import Integration Testing', () => {
  it('creates a new test db', done => {
    (async () => {
      try {
        const { user, password: pgPassword } = await iasql.connect(dbAlias, 'not-needed', 'not-needed');
        username = user;
        password = pgPassword;
        if (!username || !password) throw new Error('Did not fetch pg credentials');
        done();
      } catch (e) {
        done(e);
      }
    })();
  });

  it('installs the aws_account module', install(['aws_account']));

  it(
    'inserts aws credentials',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
    SELECT * FROM iasql_begin();
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the acm module', install(modules));

  it(
    'adds a new certificate to import',
    query(`
    SELECT * FROM certificate_import('${cert}', '${key}', '${region}', '');
  `),
  );

  it(
    'check new certificate added',
    query(
      `
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls modules', uninstall(modules));

  it('installs modules', install(modules));

  it(
    'check certificate count after uninstall/install',
    query(
      `
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'deletes a certificate imported',
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM certificate
    WHERE domain_name = '${domainName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the delete', commit());

  it(
    'check certificate count after delete',
    query(
      `
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'import a certificate in non-default region',
    query(`
    SELECT * FROM certificate_import('${cert}', '${key}', '${region}', '');
  `),
  );

  it(
    'verifies the certificate in the non-default region is created',
    query(
      `
    SELECT *
    FROM certificate
    WHERE domain_name = '${domainName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'deletes the certificate in non-default region',
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM certificate;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the deletion of the certificate in the non-default region', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
