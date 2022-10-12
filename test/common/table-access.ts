import * as iasql from '../../src/services/iasql';
import { finish, execComposeUp, execComposeDown, runInstall } from '../helpers';

const dbAlias = 'tableaccesstest';
const uid = '12345';
const install = runInstall.bind(null, dbAlias);
const runSql = iasql.runSql.bind(null, dbAlias, uid);
const email = 'test@example.com';

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Testing table creation and access', () => {
  it('creates a new test db', done => void iasql.connect(dbAlias, uid, email).then(...finish(done)));

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

  it('deletes the test db', done => void iasql.disconnect(dbAlias, uid).then(...finish(done)));
});
