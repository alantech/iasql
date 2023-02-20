import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  runBegin,
  runCommit,
  runInstall,
  runQuery,
  itDocs,
} from '../helpers';

const latestVersion = config.version;

const dbAlias = 'accounttest';
const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const region = defaultRegion();

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('AwsAccount Integration Testing', () => {
  // TODO: Restore some mechanism to verify credentials
  /*it('does not create a test DB with fake credentials', (done) => void iasql.connect(
    dbAlias,
    region,
    'fake',
    'credentials',
    'not-needed').then(
      () => done(new Error('Should not have succeeded')),
      () => done(),
    ));*/

  it('creates a new test db with the same name', done => {
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

  itDocs('installs the aws_account module', install(['aws_account']));

  itDocs(
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

  it(
    'inserts a second, useless row into the aws_credentials table',
    query(
      `
      INSERT INTO aws_credentials (access_key_id, secret_access_key) VALUES ('fake', 'creds')
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('does absolutely nothing when you apply this', commit());

  itDocs(
    'selects a default region',
    query(
      `
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'confirms that the default region was set',
    query(
      `
    SELECT * FROM aws_regions WHERE is_default = TRUE;
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('tries to set a second default region', done =>
    void query(`
      UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
    `)((e?: any) => {
      console.log({ e });
      try {
        expect(e?.message).toBeTruthy();
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it(
    'confirms that the default region was not changed',
    query(
      `
    SELECT * FROM aws_regions WHERE is_default = TRUE;
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].region).toBe(region);
      },
    ),
  );

  itDocs(
    'updates the default region with the handy `default_aws_region` function',
    query(
      `
    SELECT * FROM default_aws_region('us-east-1');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].default_aws_region).toBe('us-east-1');
      },
    ),
  );

  itDocs(
    'clears out the default region',
    query(
      `
    UPDATE aws_regions SET is_default = false;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'confirms the `default_aws_region` still returns a default region',
    query(
      `
    SELECT * FROM default_aws_region();
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].default_aws_region).toBe('us-east-1');
      },
    ),
  );

  it(
    'updates the default region again',
    query(
      `
    SELECT * FROM default_aws_region('us-east-1');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].default_aws_region).toBe('us-east-1');
      },
    ),
  );

  it('starts a transaction', begin());

  it('does absolutely nothing when you sync this', commit());

  it('confirms that you cannot preview without opening a transaction', done =>
    void query(`
      select iasql_preview();
    `)((e?: any) => {
      try {
        expect(e?.message).toContain('Cannot execute without calling iasql_begin() first');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it(
    'removes the useless row',
    query(
      `
    DELETE FROM aws_credentials WHERE access_key_id = 'fake'
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'returns records when calling iasql_help',
    query(
      `
    SELECT * FROM iasql_help();
  `,
      (res: any[]) => expect(res.length).toBeGreaterThan(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));

  /* it('creates a new test db using the oldest version via trickery', done => {
    // This works because we don't actually `Object.freeze` the config and `const` in JS is dumb
    config.modules.latestVersion = oldestVersion;
    iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done));
  });

  it(
    'confirms the version is the oldest version',
    query(
      `
    SELECT name FROM iasql_module LIMIT 1;
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].name.split('@')[1]).toEqual(oldestVersion);
      },
    ),
  );

  it('deletes the test db and restores the version', done => {
    iasql.disconnect(dbAlias, 'not-needed').then(...finish(done));
    config.modules.latestVersion = latestVersion;
  }); */

  it('creates another test db', done => {
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

  it(
    'updates the iasql_* modules to pretend to be an ancient version',
    query(
      `
    DELETE FROM iasql_tables WHERE "module" = 'iasql_platform@${latestVersion}';
    UPDATE iasql_module SET name = 'iasql_platform@0.0.2' WHERE name = 'iasql_platform@${latestVersion}';
    UPDATE iasql_module SET name = 'iasql_functions@0.0.2' WHERE name = 'iasql_functions@${latestVersion}';
  `,
      undefined,
      true,
    ),
  );

  it('confirms that you cannot install anything in a busted db', done =>
    void query(`
    SELECT * FROM iasql_install('aws_security_group');
  `)((e?: any) => {
      console.log({ e });
      try {
        expect(e?.message).toContain('Unsupported version');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it('confirms that you cannot start a transaction in a busted db', done =>
    void query(`
    SELECT * FROM iasql_begin();
  `)((e?: any) => {
      console.log({ e });
      try {
        expect(e?.message).toContain('Unsupported version');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it('deletes the busted test db', done =>
    void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
