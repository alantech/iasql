import { execSync, } from 'child_process'

import * as iasql from '../src/services/iasql'
import { getPrefix, query, runApply, finish, } from './helpers'

jest.setTimeout(240000);

beforeAll(() => {
  execSync('cd test && docker-compose up -d && sleep 5');
});

afterAll(() => {
  execSync('cd test && docker-compose down');
});

const prefix = getPrefix();
const dbAlias = 'sgtest';

describe('Security Group Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    'us-west-2',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed').then(...finish(done)));

  it('installs the security group module', (done) => void iasql.install(
    ['aws_security_group'],
    dbAlias,
    'not-needed').then(...finish(done)));

  it('adds a new security group', query(`  
    INSERT INTO aws_security_group (description, group_name)
    VALUES ('Security Group Test', '${prefix}sgtest');
  `, dbAlias));

  it('applies the security group change', (done) => runApply(done, dbAlias));

  it('adds security group rules', query(`
    INSERT INTO aws_security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT true, 'tcp', 443, 443, '0.0.0.0/8', '${prefix}testrule', id
    FROM aws_security_group
    WHERE group_name = '${prefix}sgtest';
    INSERT INTO aws_security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv6, description, security_group_id)
    SELECT false, 'tcp', 22, 22, '::/8', '${prefix}testrule2', id
    FROM aws_security_group
    WHERE group_name = '${prefix}sgtest';
  `, dbAlias));

  it('applies the security group rule change', (done) => runApply(done, dbAlias));

  it('updates the security group rule', query(`
    UPDATE aws_security_group_rule SET to_port = 8443 WHERE description = '${prefix}testrule';
    UPDATE aws_security_group_rule SET to_port = 8022 WHERE description = '${prefix}testrule2';
  `, dbAlias));

  it('applies the security group rule change (again)', (done) => runApply(done, dbAlias));

  it('updates the security group', query(`
    UPDATE aws_security_group SET group_name = '${prefix}sgtest2' WHERE group_name = '${prefix}sgtest';
  `, dbAlias));

  it('applies the security group change (again)', (done) => runApply(done, dbAlias));

  it('deletes the security group rule', query(`
    DELETE FROM aws_security_group_rule WHERE description = '${prefix}testrule';
    DELETE FROM aws_security_group_rule WHERE description = '${prefix}testrule2';
  `, dbAlias));

  it('applies the security group rule change (last time)', (done) => runApply(done, dbAlias));

  it('deletes the security group', query(`
    DELETE FROM aws_security_group
    WHERE group_name = '${prefix}sgtest2';
  `, dbAlias));

  it('applies the security group change (last time)', (done) => runApply(done, dbAlias));

  // Special testing involving the default security group you can't edit or delete
  
  it('clears out any default security group rules if they exist', query(`
    DELETE FROM aws_security_group_rule
    USING aws_security_group
    WHERE aws_security_group_rule.security_group_id = aws_security_group.id
    AND aws_security_group.group_name = 'default';
  `, dbAlias));

  it('applies this change', (done) => runApply(done, dbAlias));
  
  it('tries to delete the default security group', query(`
    DELETE FROM aws_security_group WHERE group_name = 'default';
  `, dbAlias));

  it('applies the security group change which will restore the record', (done) => runApply(done, dbAlias));

  it('tries to change the default security group description', query(`
    UPDATE aws_security_group SET description = 'Not the default' where group_name = 'default';
  `, dbAlias));

  it('applies the security group change which will undo this change', (done) => runApply(done, dbAlias));

  it('tries to change the default security group id which triggers simultaneous create/delete', query(`
    UPDATE aws_security_group SET group_id = 'remakethis' where group_name = 'default';
  `, dbAlias));

  it('applies the security group change which will recreate the record', (done) => runApply(done, dbAlias));

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
