import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  itDocs,
  runBegin,
  runCommit,
  runInstall,
  runInstallAll,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'secrettest';
const secretName = `${prefix}${dbAlias}`;
const secretValue = 'value';

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_secrets_manager'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Secrets Manager Integration Testing', () => {
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

  itDocs('installs the secret module', install(modules));

  it('starts a transaction', begin());

  it(
    'adds a new secret',
    query(
      `  
    INSERT INTO secret (name, value)
    VALUES ('${secretName}', '${secretValue}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  itDocs('starts a transaction', begin());

  itDocs(
    'adds a new secret',
    query(
      `  
    INSERT INTO secret (name, description, value)
    VALUES ('${secretName}', 'description', '${secretValue}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs('applies the secret change', commit());

  itDocs(
    'check secret is available',
    query(
      `
  SELECT * FROM secret WHERE name='${secretName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'tries to update secret description',
    query(
      `
  UPDATE secret SET description='new description' WHERE name='${secretName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the secret description update', commit());

  itDocs(
    'checks that secret has been been modified',
    query(
      `
  SELECT * FROM secret WHERE description='new description';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'tries to update secret value',
    query(
      `
  UPDATE secret SET value='newvalue' WHERE name='${secretName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the secret value update', commit());

  it('starts a transaction', begin());

  itDocs(
    'tries to update version',
    query(
      `
  UPDATE secret SET version_id='fakeVersion' WHERE name='${secretName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the secret version update', commit());

  it(
    'checks that version has not been modified',
    query(
      `
  SELECT * FROM secret WHERE version_id='fakeVersion';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('uninstalls the secret module', uninstall(modules));

  it('installs the secret module again (to make sure it reloads stuff)', install(modules));

  itDocs(
    'checks secret count',
    query(
      `
    SELECT * FROM secret WHERE name='${secretName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  itDocs('starts a transaction', begin());

  itDocs(
    'moves the secret to another region with a new value',
    query(
      `
    UPDATE secret SET region='us-east-1', value='new_secret' WHERE name='${secretName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs('applies the secret region update', commit());

  itDocs(
    'confirms that the secret was moved',
    query(
      `
    SELECT * FROM secret WHERE name = '${secretName}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].region).toBe('us-east-1');
      },
    ),
  );

  it('starts a transaction', begin());

  it(
    'creates the same secret back in the original region at the same time',
    query(
      `
    INSERT INTO secret (name, description, value)
    VALUES ('${secretName}', 'description', '${secretValue}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the secret re-creation', commit());

  it(
    'confirms that the secret was created',
    query(
      `
    SELECT * FROM secret WHERE name = '${secretName}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(2);
      },
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'deletes the secret',
    query(
      `
    DELETE FROM secret
    WHERE name = '${secretName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the secret removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('Secret install/uninstall', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the secret module', install(modules));

  it('uninstalls the secret module', uninstall(modules));

  it('installs all modules', installAll());

  it('uninstalls the secret module', uninstall(['aws_secrets_manager']));

  it('installs the secret module', install(['aws_secrets_manager']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
