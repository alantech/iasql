import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  getPrefix,
  runQuery,
  runInstall,
  runUninstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'sgtest';
const sgName = `${prefix}${dbAlias}`;
const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ['aws_security_group', 'aws_vpc'];
const randIPBlock = Math.floor(Math.random() * 254) + 1; // 0 collides with the default CIDR block
const randIPBlock2 = Math.floor(Math.random() * 254) + 1; // 0 collides with the default CIDR block

jest.setTimeout(240000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe('Security Group Integration Testing', () => {
  it('creates a new test db', done =>
    void iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

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
    ),
  );

  it('syncs the regions', sync());

  it(
    'sets the default region',
    query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${process.env.AWS_REGION}';
  `),
  );

  it('installs the security group module', install(modules));

  it(
    'adds a new security group',
    query(`  
    INSERT INTO security_group (description, group_name)
    VALUES ('Security Group Test', '${prefix}sgtest');
  `),
  );

  it('undo changes', sync());

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'adds a new security group',
    query(`  
    INSERT INTO security_group (description, group_name)
    VALUES ('Security Group Test', '${prefix}sgtest');
  `),
  );

  it('applies the security group change', apply());

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  /*it(
    'adds security group rules',
    query(`
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT true, 'tcp', 443, 443, '0.0.0.0/8', '${prefix}testrule', id
    FROM security_group
    WHERE group_name = '${prefix}sgtest';
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv6, description, security_group_id)
    SELECT false, 'tcp', 22, 22, '::/8', '${prefix}testrule2', id
    FROM security_group
    WHERE group_name = '${prefix}sgtest';
  `),
  );

  it('applies the security group rule change', apply());

  it(
    'updates the security group rule',
    query(`
    UPDATE security_group_rule SET to_port = 8443 WHERE description = '${prefix}testrule';
    UPDATE security_group_rule SET to_port = 8022 WHERE description = '${prefix}testrule2';
  `),
  );

  it(
    'check security_group update',
    query(
      `
    SELECT *
    FROM security_group_rule
    INNER JOIN security_group ON security_group.id = security_group_rule.security_group_id
    WHERE group_name = '${sgName}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(2);
        expect([8443, 8022].includes(res[0]['to_port'])).toBe(true);
        return expect([8443, 8022].includes(res[1]['to_port'])).toBe(true);
      },
    ),
  );

  it('applies the security group rule change (again)', apply());

  it(
    'updates the security group',
    query(`
    UPDATE security_group SET group_name = '${prefix}sgtest2' WHERE group_name = '${prefix}sgtest';
  `),
  );

  it('applies the security group change (again)', apply());

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name = '${prefix}sgtest2';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Testing potential race condition with security group with very large ruleset, particularly
  // during install

  it(
    'inserts a security group with a large ruleset and more',
    query(`
    INSERT INTO vpc (cidr_block)
    VALUES ('192.${randIPBlock}.0.0/16'), ('192.${randIPBlock2}.0.0/16');

    INSERT INTO security_group (description, group_name)
    VALUES
      ('Security Group with a large ruleset', '${prefix}beegbeegsg'),
      ('Security Group with no rules', '${prefix}teenysg'),
      ('Another *smashes cup*', '${prefix}thorsg'),
      ('And Another One And Another One...', '${prefix}djkaledsg'),
      ('The end', '${prefix}lastsg');

    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT x.is_egress, x.ip_protocol, x.from_port, x.to_port, x.cidr_ipv4, x.description, s.security_group_id
    FROM json_to_recordset('${JSON.stringify(
      Array(20)
        .fill('')
        .map(_ => ({
          is_egress: Math.random() > 0.5,
          ip_protocol: Math.random() > 0.5 ? 'tcp' : 'udp',
          from_port: Math.floor(Math.random() * 32768),
          to_port: Math.floor(Math.random() * 32768 + 32768),
          cidr_ipv4: `192.${Math.floor(Math.random() * 255)}.0.0/16`,
          description: [
            ['My', 'Your', 'Our', 'Their'],
            ['Fluffy', 'Stinky', 'Fuzzy', 'Angry', 'Dirty', 'Dry', 'Dangerous', 'Dingy', 'Ecstatic'],
            ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'],
            ['Cat', 'Dog', 'Horse', 'Orangutan', 'Parrot', 'Sheep', 'GOAT', 'Walrus', 'Llama', 'Uncle Jim'],
            ['Ate', 'Sat On', 'Punched', 'Debated With', 'Raced', 'Worshipped', 'Cleaned', 'Observed'],
            ['Two', 'Five', 'Three', 'Twenty-Seven', 'OVER 9000'],
            ['Seahorses', 'Gorillas', 'Bats', 'Gerbils', 'Orcas', 'Sharks', 'Second Cousins'],
          ]
            .map(r => r[Math.floor(Math.random() * r.length)])
            .join(' '),
        })),
      undefined,
      '  ',
    )}') AS x(is_egress boolean, ip_protocol varchar, from_port integer, to_port integer, cidr_ipv4 cidr, description varchar)
    INNER JOIN (
      SELECT id AS security_group_id FROM security_group WHERE group_name = '${prefix}beegbeegsg'
    ) AS s ON 1 = 1;
  `),
  );

  it('should successfully create this mess', apply());*/

  // create rule targetting to another security group
  it(
    'adds a new security group',
    query(`  
    INSERT INTO security_group (description, group_name)
    VALUES ('Source Security Group Test', '${prefix}sgsourcetest');
  `),
  );

  it('creates the source security group', apply());

  it('should fail when inserting a security group rule with ip and security rule', () => {
    try {
      query(`
      INSERT INTO security_group_rule(security_group_id, ip_protocol, source_security_group_id, is_egress) 
      VALUES ((SELECT id FROM security_group WHERE group_name='${prefix}sgtest'), 'tcp',
      (SELECT id from security_group WHERE group_name='${prefix}sgsourcetest'), false);
      `);
    } catch (e) {
      expect(e).toBeTruthy;
    }
  });

  it(
    'adds a new security group rule',
    query(`
  INSERT INTO security_group_rule(description, security_group_id, source_security_group_id, is_egress) 
  VALUES ('${prefix}sgsourcetestrule', (SELECT id FROM security_group WHERE group_name='${prefix}sgtest'),
  (SELECT id from security_group WHERE group_name='${prefix}sgsourcetest'), false);
  `),
  );
  it('creates the source security group rule', apply());

  it(
    'deletes the source security group rule',
    query(`DELETE FROM security_group_rule WHERE description = '${prefix}sgsourcetestrule'`),
  );
  it(
    'deletes the source security group',
    query(`DELETE FROM security_group WHERE description = '${prefix}sgsourcetest'`),
  );

  it('uninstalls the security group module', uninstall(modules));

  it('installs the security group module', install(modules));

  it(
    'deletes the security group rules',
    query(`
    DELETE FROM security_group_rule WHERE description = '${prefix}testrule';
    DELETE FROM security_group_rule WHERE description = '${prefix}testrule2';

    DELETE FROM security_group_rule
    USING security_group
    INNER JOIN vpc on security_group.vpc_id = vpc.id
    WHERE vpc.cidr_block IN ('192.${randIPBlock}.0.0/16', '192.${randIPBlock2}.0.0/16');

    DELETE FROM security_group_rule
    USING security_group
    WHERE security_group_rule.security_group_id = security_group.id
    AND security_group.group_name = '${prefix}beegbeegsg';
  `),
  );

  it('applies the security group rule change (last time)', apply());

  it(
    'deletes the security groups',
    query(`
    DELETE FROM security_group
    WHERE group_name in (
      '${prefix}sgtest2', '${prefix}beegbeegsg', '${prefix}teenysg',
      '${prefix}thorsg', '${prefix}djkaledsg', '${prefix}lastsg'
    );

    DELETE FROM security_group
    USING vpc
    WHERE security_group.vpc_id = vpc.id
    AND vpc.cidr_block IN ('192.${randIPBlock}.0.0/16', '192.${randIPBlock2}.0.0/16');

    DELETE FROM vpc WHERE cidr_block IN ('192.${randIPBlock}.0.0/16', '192.${randIPBlock2}.0.0/16');
  `),
  );

  it('applies the security group change (last time)', apply());

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name = '${prefix}sgtest2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check security_group update',
    query(
      `
    SELECT *
    FROM security_group_rule
    INNER JOIN security_group ON security_group.id = security_group_rule.security_group_id
    WHERE group_name = '${prefix}sgtest2';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  // Special testing involving the default security group you can't edit or delete

  it(
    'clears out any default security group rules if they exist',
    query(`
    DELETE FROM security_group_rule
    USING security_group
    WHERE security_group_rule.security_group_id = security_group.id
    AND security_group.group_name = 'default';
  `),
  );

  it('applies this change', apply());

  it(
    'tries to delete the default security group',
    query(`
    DELETE FROM security_group WHERE group_name = 'default';
  `),
  );

  it('applies the security group change which will restore the record', apply());

  it(
    'tries to change the default security group description',
    query(`
    UPDATE security_group SET description = 'Not the default' where group_name = 'default';
  `),
  );

  it('applies the security group change which will undo this change', apply());

  it(
    'tries to change the default security group id which triggers simultaneous create/delete',
    query(`
    UPDATE security_group SET group_id = 'remakethis' where group_name = 'default';
  `),
  );

  it('applies the security group change which will recreate the record', apply());

  it(
    'adds another two security groups for a more complex test',
    query(`
    INSERT INTO security_group (description, group_name)
    VALUES
      ('Security Group Test 3', '${prefix}sgtest3'),
      ('Security Group Test 4', '${prefix}sgtest4');
  `),
  );

  it('creates these security groups', apply());

  it(
    'creates a new security group, deletes another security group, and modifies a third',
    query(`
    INSERT INTO security_group (description, group_name)
    VALUES ('Security Group Test 5', '${prefix}sgtest5');

    DELETE FROM security_group WHERE group_name = '${prefix}sgtest3';

    UPDATE security_group
    SET description = 'Security Group Test Four'
    WHERE group_name = '${prefix}sgtest4';
  `),
  );

  it('performs all of these operations', apply());

  it(
    'checks all of these security_group changes',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name in ('${prefix}sgtest3', '${prefix}sgtest4', '${prefix}sgtest5');
  `,
      (res: any[]) => {
        expect(res.length).toBe(2);
        expect(res.map(r => r.description).includes('Security Group Test Four')).toBe(true);
        expect(res.map(r => r.description).includes('Security Group Test 5')).toBe(true);
      },
    ),
  );

  it(
    'deletes these test records',
    query(`
    DELETE FROM security_group WHERE group_name in ('${prefix}sgtest4', '${prefix}sgtest5');
  `),
  );

  it('deletes the final test records', apply());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('Security Group install/uninstall', () => {
  it('creates a new test db', done =>
    void iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

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
    ),
  );

  it('syncs the regions', sync());

  it(
    'sets the default region',
    query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `),
  );

  it(
    'installs the Security Group module and confirms two tables are created',
    query(
      `
    select * from iasql_install('aws_security_group', 'aws_vpc');
  `,
      (res: any[]) => {
        expect(res.length).toBe(8);
      },
    ),
  );

  it(
    'uninstalls the Security Group module and confirms two tables are removed',
    query(
      `
    select * from iasql_uninstall('aws_security_group', 'aws_vpc');
  `,
      (res: any[]) => {
        expect(res.length).toBe(8);
      },
    ),
  );

  it('installs all modules', done =>
    void iasql.install([], dbAlias, config.db.user, true).then(...finish(done)));

  it(
    'uninstalls the Security Group module',
    uninstall([
      'aws_rds',
      'aws_ecs_fargate',
      'aws_ecs_simplified',
      'aws_elb',
      'aws_security_group',
      'aws_ec2',
      'aws_ec2_metadata',
      'aws_route53_hosted_zones',
      'aws_memory_db',
      'aws_acm_request',
    ]),
  );

  /*it(
    'inserts a new VPC (that creates a new default SG automatically)',
    query(`
    INSERT INTO vpc (cidr_block)
    VALUES ('192.${randIPBlock}.0.0/16');
  `),
  );

  it('creates the VPC', apply());

  it('installs the Security Group module', install(['aws_security_group']));

  it(
    'confirms that the auto-generated security group is there',
    query(
      `
    SELECT sg.* FROM security_group as sg
    INNER JOIN vpc on vpc.id = sg.vpc_id
    WHERE vpc.cidr_block = '192.${randIPBlock}.0.0/16';
  `,
      (res: any[]) => {
        expect(res.length).toBeGreaterThanOrEqual(1);
      },
    ),
  );

  it('uninstalls the Security Group module again (to be easier)', uninstall(['aws_security_group']));

  it(
    'deletes the vpc',
    query(`
    DELETE FROM vpc
    WHERE cidr_block = '192.${randIPBlock}.0.0/16';
  `),
  );

  it('applies the vpc removal', apply());*/

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
