import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import * as scheduler from '../../src/services/scheduler';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  runCommit,
  runInstall,
  runQuery,
} from '../helpers';

const latestVersion = config.modules.latestVersion;
const oldestVersion = config.modules.oldestVersion;

const dbAlias = 'accounttest';
const commit = runCommit.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const runSql = iasql.runSql.bind(null, dbAlias, 'not-needed');
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

  it('runSql segue: confirms bad sql queries return an error string', done => {
    (async () => {
      try {
        await runSql('SELECT * FROM foo', false);
        done(new Error('This line should not be reached'));
      } catch (_) {
        done();
      }
    })();
  });

  it('runSql segue by statement: confirms bad sql queries return an error string', done => {
    (async () => {
      try {
        await runSql('SELECT * FROM foo', true);
        done(new Error('This line should not be reached'));
      } catch (_) {
        done();
      }
    })();
  });

  it('runSql segue: confirms good sql queries return an array of records', done => {
    (async () => {
      const rows = await runSql('SELECT * FROM aws_credentials', false);
      if (
        rows instanceof Array &&
        rows[0] instanceof Array &&
        rows[0][0].access_key_id === process.env.AWS_ACCESS_KEY_ID
      ) {
        done();
      } else {
        done(new Error('Unexpected response from normal query'));
      }
    })();
  });

  it('runSql segue by statement: confirms good sql queries return an array of records', done => {
    (async () => {
      const rows = await runSql('SELECT * FROM aws_credentials', true);
      if (
        rows instanceof Array &&
        rows[0]['result'] instanceof Array &&
        rows[0]['result'][0].access_key_id === process.env.AWS_ACCESS_KEY_ID
      ) {
        done();
      } else {
        done(new Error('Unexpected response from normal query'));
      }
    })();
  });

  it('runSql segue: confirms multiple sql queries returns an array of arrays of records', done => {
    (async () => {
      const results = await runSql('SELECT * FROM iasql_module; SELECT * FROM iasql_help();', false);
      if (
        results instanceof Array &&
        results[0] instanceof Array &&
        (results[0][0] as any).name.includes('@')
      ) {
        done();
      } else {
        done(new Error('Unexpected response from batch query'));
      }
    })();
  });

  it('runSql segue by statements: confirms multiple sql queries returns an array of arrays of records', done => {
    (async () => {
      const results = await runSql('SELECT * FROM iasql_module; SELECT * FROM iasql_help();', true);
      if (
        results instanceof Array &&
        results[0]['result'] instanceof Array &&
        (results[0]['result'][0] as any).name.includes('@')
      ) {
        done();
      } else {
        done(new Error('Unexpected response from batch query'));
      }
    })();
  });

  it(
    'inserts a second, useless row into the aws_credentials table',
    query(
      `
      SELECT * FROM iasql_begin();
      INSERT INTO aws_credentials (access_key_id, secret_access_key) VALUES ('fake', 'creds')
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('does absolutely nothing when you apply this', commit());

  it(
    'selects a default region',
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

  it(
    'confirms that the default region was set',
    query(
      `
    SELECT * FROM aws_regions WHERE is_default = TRUE;
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('tries to set a second default region', done => {
    (async () => {
      try {
        await runSql(
          `
          SELECT * FROM iasql_begin();
          UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
        `,
          false,
        );
      } catch (_) {
        return done(); // This is the expected path
      }
      return done(new Error('Did not get the expected error'));
    })();
  });

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

  it(
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

  it(
    'clears out the default region',
    query(
      `
    SELECT * FROM iasql_begin();
    UPDATE aws_regions SET is_default = false;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
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

  // tests that on startup subsequent iasql ops for existing dbs succeed
  it('stops the worker for all dbs', done => void scheduler.stopAll().then(...finish(done)));
  it('starts a worker for each db', done => void scheduler.init().then(...finish(done)));

  it('does absolutely nothing when you sync this', commit());

  it(
    'does absolutely nothing when you preview this',
    query(
      `
    select iasql_preview();
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'removes the useless row',
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM aws_credentials WHERE access_key_id = 'fake'
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it(
    'returns records when calling iasql_help',
    query(
      `
    SELECT * FROM iasql_help();
  `,
      (res: any[]) => expect(res.length).toBeGreaterThan(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));

  it('creates a new test db using the oldest version via trickery', done => {
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
  });

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
    SELECT * FROM iasql_begin();
    UPDATE iasql_module SET name = 'iasql_platform@0.0.2' WHERE name = 'iasql_platform@${latestVersion}';
    UPDATE iasql_module SET name = 'iasql_functions@0.0.2' WHERE name = 'iasql_functions@${latestVersion}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('confirms that you cannot install anything in a busted db', done =>
    void query(`
    SELECT * FROM iasql_install('aws_security_group');
  `)((e?: any) => {
      console.log({ e });
      try {
        expect(e?.detail).toContain('Unsupported version');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it('confirms that you cannot apply in a busted db', done =>
    void query(`
    SELECT * FROM iasql_commit();
  `)((e?: any) => {
      console.log({ e });
      try {
        expect(e?.detail).toContain('Unsupported version');
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
