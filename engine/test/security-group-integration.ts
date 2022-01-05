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

function finish(done: (e?: any) => {}) {
  return [() => done(), (e: any) => { done(e); }];
}

function runApply(done: (e?: any) => {}) {
  iasql.apply('sgtest', false, 'not-needed').then(...finish(done));
}

function query(queryString: string) {
  return function (done: (e?: any) => {}) {
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
      conn.query(queryString).then(() => {
        conn.close().then(...finish(done));
      }, (e) => {
        conn.close().then(() => done(e), (e2) => done(e2));
      });
    }, done);
  }
}

const chars = [
  Array(26).fill('a').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
  Array(26).fill('A').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
  Array(10).fill('0').map((c, i) => String.fromCharCode(c.charCodeAt() + i)),
].flat();
const randChar = (): string => chars[Math.floor(Math.random() * chars.length)];
const prefix = Array(7).fill('').map(() => randChar()).join('');

describe('Security Group Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.add(
    'sgtest',
    'us-west-2',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the security group module', (done) => void iasql.install(
    ['aws_security_group'],
    'sgtest',
    'not-needed').then(...finish(done)));

  it('adds a new security group', query(`  
    INSERT INTO aws_security_group (description, group_name)
    VALUES ('Security Group Test', '${prefix}sgtest');
  `));

  it('applies the security group change', runApply);

  it('adds security group rules', query(`
    INSERT INTO aws_security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT true, 'tcp', 443, 443, '0.0.0.0/8', '${prefix}testrule', id
    FROM aws_security_group
    WHERE group_name = '${prefix}sgtest';
    INSERT INTO aws_security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv6, description, security_group_id)
    SELECT false, 'tcp', 22, 22, '::/8', '${prefix}testrule2', id
    FROM aws_security_group
    WHERE group_name = '${prefix}sgtest';
  `));

  it('applies the security group rule change', runApply);

  it('updates the security group rule', query(`
    UPDATE aws_security_group_rule SET to_port = 8443 WHERE description = '${prefix}testrule';
    UPDATE aws_security_group_rule SET to_port = 8022 WHERE description = '${prefix}testrule2';
  `));

  it('applies the security group rule change (again)', runApply);

  it('updates the security group', query(`
    UPDATE aws_security_group SET group_name = '${prefix}sgtest2' WHERE group_name = '${prefix}sgtest';
  `));

  it('applies the security group change (again)', runApply);

  it('deletes the security group rule', query(`
    DELETE FROM aws_security_group_rule WHERE description = '${prefix}testrule';
    DELETE FROM aws_security_group_rule WHERE description = '${prefix}testrule2';
  `));

  it('applies the security group rule change (last time)', runApply);

  it('deletes the security group', query(`
    DELETE FROM aws_security_group
    WHERE group_name = '${prefix}sgtest2';
  `));

  it('applies the security group change (last time)', runApply);

  it('deletes the test db', (done) => void iasql
    .remove('sgtest', 'not-needed')
    .then(...finish(done)));
});
