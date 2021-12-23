import { execSync, } from 'child_process'

import { createConnection, } from 'typeorm'

import * as iasql from '../src/services/iasql'

jest.setTimeout(120000);

beforeAll(() => {
  execSync('cd test && docker-compose up -d && sleep 5');
});

afterAll(() => {
  execSync('cd test && docker-compose down');
});

describe('Security Group Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.add(
    'sgtest',
    'us-west-2',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(() => done(), (e) => { done(e); }));

  it('installs the security group module', (done) => void iasql.install(
    ['aws_security_group'],
    'sgtest',
    'not-needed').then(() => done(), (e) => { done(e); }));
  
  it('adds a new security group', (done) => {
    createConnection({
      name: 'sgtest',
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'localhost',
      port: 5432,
      database: 'sgtest',
      extra: { ssl: false, },
    }).then((conn) => {
      conn.query(`
        INSERT INTO aws_security_group (description, group_name)
        VALUES ('Security Group Test', 'sgtest');
      `).then(() => {
        conn.close().then(() => done(), (e) => { done(e); });
      }, (e) => { done(e); });
    }, (e) => { done(e); });
  });

  it('applies the security group change', (done) => void iasql
    .apply('sgtest', false, 'not-needed')
    .then(() => done(), (e) => { done(e); }));

  it('deletes the security group', (done) => {
    createConnection({
      name: 'sgtest',
      type: 'postgres',
      username: 'postgres',
      password: 'test',
      host: 'localhost',
      port: 5432,
      database: 'sgtest',
      extra: { ssl: false, },
    }).then((conn) => {
      conn.query(`
        DELETE FROM aws_security_group
        WHERE group_name = 'sgtest';
      `).then(() => {
        conn.close().then(() => done(), (e) => { done(e); });
      }, (e) => { done(e); });
    }, (e) => { done(e); });
  });

  it('applies the security group change (again)', (done) => void iasql
    .apply('sgtest', false, 'not-needed')
    .then(() => done(), (e) => { done(e); }));

  it('deletes the test db', (done) => void iasql
    .remove('sgtest', 'not-needed')
    .then(() => done(), (e) => { done(e); }));
});
