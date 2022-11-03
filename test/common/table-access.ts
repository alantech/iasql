import * as iasql from '../../src/services/iasql';
import { finish, execComposeUp, execComposeDown, runInstall, runQuery } from '../helpers';

const dbAlias = 'tableaccesstest';
const uid = '12345';
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias)
const runSql = iasql.runSql.bind(null, dbAlias, uid);
const email = 'test@example.com';

let pgPassword: string, pgUser: string;

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Testing table creation and access', () => {
  it('creates a new test db', done => {
    (async () => {
      try {
        const {user, password} = await iasql.connect(dbAlias, uid, email);
        pgPassword = password;
        pgUser = user;
        if (!pgPassword || !pgUser) done(new Error('Did not fetch pg credentials'));
        done();
      } catch(e) {
        done(e);
      }
    })();
  });

  it('runSql: create custom table', (done) => {
    (async () => {
      try {
        await runSql('CREATE TABLE example (id serial PRIMARY KEY);', false);
        done();
      } catch(e) {
        done(e);
      }
    })();
  });

  it('runSql: drop custom table', (done) => {
    (async () => {
      try {
        await runSql('DROP TABLE example;', false);
        done();
      } catch(e) {
        done(e);
      }
    })();
  });
  
  it('dbUser: create custom table', query(`
    CREATE TABLE example_2 (id serial PRIMARY KEY);
  `, undefined, true, () => ({username: pgUser, password: pgPassword})));

  it('dbUser: drop a custom table', query(`
    DROP TABLE example_2;
  `, undefined, true, () => ({username: pgUser, password: pgPassword})));

  it('installs the aws_account module', install(['aws_account']));

  it('runSql: select IaSQL managed table', (done) => {
    (async () => {
      try {
        await runSql('SELECT * FROM aws_credentials;', false);
        done();
      } catch(e) {
        done(e);
      }
    })();
  });

  it('dbUser: select IaSQL managed table', query(`
    SELECT * FROM aws_credentials;
  `, undefined, true, pgUser, pgPassword));

  it('runSql: fails to drop IaSQL managed table', (done) => {
    (async () => {
      try {
        await runSql('DROP TABLE aws_credentials;', false);
        done(new Error('This line should not be reached'));
      } catch (e) {
        done();
      }
    })();
  });

  it('dbUser: fails to drop IaSQL managed table', (done) => {
    query(`
      DROP TABLE aws_credentials;
    `, undefined, true, pgUser, pgPassword)((e: any) => {
      if (!e) return done(new Error('Somehow did not fail to drop `aws_credentials`'));
      return done();
    });
  });

  it('deletes the test db', done => void iasql.disconnect(dbAlias, uid).then(...finish(done)));
});
