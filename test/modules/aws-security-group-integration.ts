import * as iasql from '../../src/services/iasql'
import { getPrefix, runQuery, runInstall, runUninstall, runApply, finish, execComposeUp, execComposeDown, runSync, } from '../helpers'

const prefix = getPrefix();
const dbAlias = 'sgtest';
const sgName = `${prefix}${dbAlias}`;
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_security_group@0.0.1'];

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown(modules));

describe('Security Group Integration Testing', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    process.env.AWS_REGION ?? 'barf',
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the security group module', install(
    modules));

  it('adds a new security group', query(`  
    INSERT INTO security_group (description, group_name)
    VALUES ('Security Group Test', '${prefix}sgtest');
  `));
  
  it('undo changes', sync());

  it('check security_group insertion', query(`
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('adds a new security group', query(`  
    INSERT INTO security_group (description, group_name)
    VALUES ('Security Group Test', '${prefix}sgtest');
  `));

  it('applies the security group change', apply());

  it('check security_group insertion', query(`
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('adds security group rules', query(`
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT true, 'tcp', 443, 443, '0.0.0.0/8', '${prefix}testrule', id
    FROM security_group
    WHERE group_name = '${prefix}sgtest';
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv6, description, security_group_id)
    SELECT false, 'tcp', 22, 22, '::/8', '${prefix}testrule2', id
    FROM security_group
    WHERE group_name = '${prefix}sgtest';
  `));

  it('applies the security group rule change', apply());

  it('updates the security group rule', query(`
    UPDATE security_group_rule SET to_port = 8443 WHERE description = '${prefix}testrule';
    UPDATE security_group_rule SET to_port = 8022 WHERE description = '${prefix}testrule2';
  `));

  it('check security_group update', query(`
    SELECT *
    FROM security_group_rule
    INNER JOIN security_group ON security_group.id = security_group_rule.security_group_id
    WHERE group_name = '${sgName}';
  `, (res: any[]) => {
    expect(res.length).toBe(2);
    expect([8443, 8022].includes(res[0]['to_port'])).toBe(true);
    return expect([8443, 8022].includes(res[1]['to_port'])).toBe(true);
  }));

  it('applies the security group rule change (again)', apply());

  it('updates the security group', query(`
    UPDATE security_group SET group_name = '${prefix}sgtest2' WHERE group_name = '${prefix}sgtest';
  `));

  it('applies the security group change (again)', apply());

  it('check security_group insertion', query(`
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check security_group insertion', query(`
    SELECT *
    FROM security_group
    WHERE group_name = '${prefix}sgtest2';
  `, (res: any[]) => expect(res.length).toBe(1)));

  it('uninstalls the security group module', uninstall(
    modules));

  it('installs the security group module', install(
    modules));

  it('deletes the security group rule', query(`
    DELETE FROM security_group_rule WHERE description = '${prefix}testrule';
    DELETE FROM security_group_rule WHERE description = '${prefix}testrule2';
  `));

  it('applies the security group rule change (last time)', apply());

  it('deletes the security group', query(`
    DELETE FROM security_group
    WHERE group_name = '${prefix}sgtest2';
  `));

  it('applies the security group change (last time)', apply());

  it('check security_group insertion', query(`
    SELECT *
    FROM security_group
    WHERE group_name = '${prefix}sgtest2';
  `, (res: any[]) => expect(res.length).toBe(0)));

  it('check security_group update', query(`
    SELECT *
    FROM security_group_rule
    INNER JOIN security_group ON security_group.id = security_group_rule.security_group_id
    WHERE group_name = '${prefix}sgtest2';
  `, (res: any[]) => expect(res.length).toBe(0)));

  // Special testing involving the default security group you can't edit or delete
  
  it('clears out any default security group rules if they exist', query(`
    DELETE FROM security_group_rule
    USING security_group
    WHERE security_group_rule.security_group_id = security_group.id
    AND security_group.group_name = 'default';
  `));

  it('applies this change', apply());
  
  it('tries to delete the default security group', query(`
    DELETE FROM security_group WHERE group_name = 'default';
  `));

  it('applies the security group change which will restore the record', apply());

  it('tries to change the default security group description', query(`
    UPDATE security_group SET description = 'Not the default' where group_name = 'default';
  `));

  it('applies the security group change which will undo this change', apply());

  it('tries to change the default security group id which triggers simultaneous create/delete', query(`
    UPDATE security_group SET group_id = 'remakethis' where group_name = 'default';
  `));

  it('applies the security group change which will recreate the record', apply());

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});

describe('Security Group install/uninstall', () => {
  it('creates a new test db', (done) => void iasql.add(
    dbAlias,
    'us-east-1', // Share region with common tests
    process.env.AWS_ACCESS_KEY_ID ?? 'barf',
    process.env.AWS_SECRET_ACCESS_KEY ?? 'barf',
    'not-needed', 'not-needed').then(...finish(done)));

  it('installs the Security Group module', install(
    modules));

  it('uninstalls the Security Group module', uninstall(
    modules));

  it('installs all modules', (done) => void iasql.install(
    [],
    dbAlias,
    'not-needed',
    true).then(...finish(done)));

  it('uninstalls the Security Group module', uninstall(
    ['aws_rds@0.0.1', 'aws_ecs_fargate@0.0.1', 'aws_elb@0.0.1', 'aws_security_group@0.0.1', 'aws_ec2@0.0.1'],
  ));

  it('installs the Security Group module', install(
    ['aws_security_group@0.0.1',]));

  it('deletes the test db', (done) => void iasql
    .remove(dbAlias, 'not-needed')
    .then(...finish(done)));
});
