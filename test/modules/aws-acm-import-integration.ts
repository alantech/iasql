import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getKeyCertPair,
  getPrefix,
  itDocs,
  runBegin,
  runCommit,
  runInstall,
  runQuery,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'acmimporttest';
const domainName = `${prefix}${dbAlias}.com`;
const [key, cert] = getKeyCertPair(domainName);

const begin = runBegin.bind(null, dbAlias);
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
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('starts a transaction', begin());

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs('installs the acm module', install(modules));

  itDocs(
    'adds a new certificate to import',
    query(`
    SELECT * FROM certificate_import('${cert}', '${key}', '${region}', '{}', '{ "toUpdate": "value", "toDelete": "value2" }');
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

  it(
    'check new certificate tags',
    query(
      `
        SELECT *
        FROM certificate
        WHERE domain_name = '${domainName}'
          AND tags ->> 'toDelete' = 'value2' AND tags ->> 'toUpdate' = 'value';
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
    'check new certificate tags',
    query(
      `
        SELECT *
        FROM certificate
        WHERE domain_name = '${domainName}'
          AND tags ->> 'toDelete' = 'value2' AND tags ->> 'toUpdate' = 'value';
      `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'updates a certificate tags',
    query(
      `
        UPDATE certificate
        SET tags = '{ "toUpdate": "value2", "newTag": "value3" }'
        WHERE domain_name = '${domainName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the update', commit());

  it(
    'check certificate tags after update',
    query(
      `
        SELECT *
        FROM certificate
        WHERE domain_name = '${domainName}'
          AND tags ->> 'toDelete' = 'value2';
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check certificate tags after update',
    query(
      `
        SELECT *
        FROM certificate
        WHERE domain_name = '${domainName}'
          AND tags ->> 'toUpdate' = 'value2' AND tags ->> 'newTag' = 'value3';
      `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'deletes a certificate imported',
    query(
      `
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

  itDocs(
    'import a certificate in non-default region',
    query(`
    SELECT * FROM certificate_import('${cert}', '${key}', 'us-east-1', '{}');
  `),
  );

  itDocs(
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

  it('starts a transaction', begin());

  it(
    'deletes the certificate in non-default region',
    query(
      `
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
