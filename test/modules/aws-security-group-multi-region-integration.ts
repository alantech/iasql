import * as iasql from '../../src/services/iasql';
import {
  defaultRegion as dr,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runCommit,
  runInstall,
  runQuery,
  runRollback,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'sgtest';
const sgName = `${prefix}${dbAlias}`;
const nonDefaultRegion = 'us-east-1';
const defaultRegion = dr();
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const modules = ['aws_security_group', 'aws_vpc'];

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Security Group Multi region Integration Testing', () => {
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
    SELECT * FROM iasql_begin();
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${defaultRegion}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the security group module', install(modules));

  it(
    'adds a new security group',
    query(
      `  
    SELECT * FROM iasql_begin();
  
    INSERT INTO security_group (description, group_name, region)
    VALUES ('Security Group Test', '${prefix}sgtest', '${nonDefaultRegion}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}' and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'adds a new security group',
    query(
      `  
    SELECT * FROM iasql_begin();
  
    INSERT INTO security_group (description, group_name, region, vpc_id)
    VALUES ('Security Group Test', '${prefix}sgtest', '${nonDefaultRegion}', (select id from vpc where is_default = true and region = '${nonDefaultRegion}' limit 1));
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the security group change', commit());

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}' and region = '${nonDefaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'adds security group rules',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id, region)
    SELECT true, 'tcp', 443, 443, '0.0.0.0/8', '${prefix}testrule', id, '${nonDefaultRegion}'
    FROM security_group
    WHERE group_name = '${sgName}';
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv6, description, security_group_id, region)
    SELECT false, 'tcp', 22, 22, '::/8', '${prefix}testrule2', id, '${nonDefaultRegion}'
    FROM security_group
    WHERE group_name = '${sgName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the security group rule change', commit());

  it(
    'updates the security group rule',
    query(
      `
    SELECT * FROM iasql_begin();
    UPDATE security_group_rule SET to_port = 8443 WHERE description = '${prefix}testrule';
    UPDATE security_group_rule SET to_port = 8022 WHERE description = '${prefix}testrule2';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check security_group update',
    query(
      `
    SELECT *
    FROM security_group_rule
    INNER JOIN security_group ON security_group.id = security_group_rule.security_group_id
    WHERE group_name = '${sgName}' and security_group.region = '${nonDefaultRegion}';
  `,
      (res: any[]) => {
        expect(res.length).toBe(2);
        expect([8443, 8022].includes(res[0]['to_port'])).toBe(true);
        return expect([8443, 8022].includes(res[1]['to_port'])).toBe(true);
      },
    ),
  );

  it('applies the security group rule change (again)', commit());

  it(
    'updates the security group',
    query(
      `
    WITH updated_security_group_rules AS (
      UPDATE security_group_rule SET region = '${defaultRegion}' WHERE description = '${prefix}testrule' OR description = '${prefix}testrule2'
    )
    UPDATE security_group SET region = '${defaultRegion}', vpc_id = (select id from vpc where region = '${defaultRegion}' and is_default = true limit 1) WHERE group_name = '${sgName}' and region = '${nonDefaultRegion}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the security group change (again)', commit());

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}' AND region = '${nonDefaultRegion}';
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
    WHERE group_name = '${sgName}' AND region = '${defaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group_rule
    WHERE description = '${prefix}testrule' OR description = '${prefix}testrule2' and region = '${defaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it(
    'deletes these test records',
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM security_group_rule WHERE description = '${prefix}testrule' OR description = '${prefix}testrule2' and region = '${defaultRegion}';
    DELETE FROM security_group WHERE group_name = '${sgName}' and region = '${defaultRegion}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('deletes the final test records', commit());

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group
    WHERE group_name = '${sgName}' AND region = '${defaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check security_group insertion',
    query(
      `
    SELECT *
    FROM security_group_rule
    WHERE description = '${prefix}testrule' OR description = '${prefix}testrule2' and region = '${defaultRegion}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
