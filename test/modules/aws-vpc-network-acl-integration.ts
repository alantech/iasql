import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  itDocs,
  runBegin,
  runCommit,
  runInstall,
  runInstallAll,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'vpctest';

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
// We have to install the `aws_security_group` to test fully the integration even though is not being used,
// since the `aws_vpc` module creates a `default` security group automatically.
const modules = ['aws_vpc', 'aws_security_group'];

const randIPBlock = Math.floor(Math.random() * 254) + 1; // 0 collides with the default CIDR block

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('VPC Network ACL Integration Testing', () => {
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
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `,
      undefined,
      false,
      () => ({ username, password }),
    ),
  );

  it('starts a transaction', begin());

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(
      `
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs('installs the vpc module', install(modules));

  it(
    'confirms there are availability zones present',
    query(
      `
    SELECT * FROM availability_zone;
  `,
      (res: any[]) => expect(res.length).toBeGreaterThan(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'adds a new vpc',
    query(
      `  
    INSERT INTO vpc (cidr_block, tags, enable_dns_hostnames, enable_dns_support)
    VALUES ('192.${randIPBlock}.0.0/16', '{"name":"${prefix}-1"}', true, true);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the vpc change', commit());

  it(
    'confirms that VPC exists',
    query(
      `
    SELECT * FROM vpc WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('creates network ACL', begin());

  itDocs(
    'adds a new network ACL',
    query(
      `  
    INSERT INTO network_acl (vpc_id, entries, tags)
    VALUES ((SELECT id FROM vpc WHERE  tags ->> 'name' = '${prefix}-1'), '[]', '{"name":"${prefix}-1"}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the ACL change', commit());

  it(
    'confirms that network ACL exists',
    query(
      `
    SELECT * FROM network_acl WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'adds a subnet',
    query(
      `
    INSERT INTO subnet (availability_zone, vpc_id, cidr_block, network_acl_id)
    SELECT (SELECT name FROM availability_zone WHERE region = '${region}' LIMIT 1), id, '192.${randIPBlock}.0.0/16',
    (SELECT id FROM network_acl WHERE  tags ->> 'name' = '${prefix}-1')
    FROM vpc
    WHERE is_default = false
    AND cidr_block = '192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the subnet change', commit());

  it(
    'confirms that subnet has been created with the proper network ACL',
    query(
      `
    SELECT * FROM subnet WHERE vpc_id=(SELECT id FROM vpc WHERE tags ->>'name' = '${prefix}-1') AND
    cidr_block = '192.${randIPBlock}.0.0/16' AND
    network_acl_id = (SELECT id FROM network_acl WHERE  tags ->> 'name' = '${prefix}-1');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('creates a second network ACL', begin());

  itDocs(
    'adds a new network ACL',
    query(
      `  
    INSERT INTO network_acl (vpc_id, entries, tags)
    VALUES ((SELECT id FROM vpc WHERE  tags ->> 'name' = '${prefix}-1'), '[]', '{"name":"${prefix}-2"}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the ACL change', commit());

  it('starts a transaction', begin());

  itDocs(
    'updates subnet to use default acl',
    query(
      `
      UPDATE subnet SET network_acl_id = NULL WHERE vpc_id=(SELECT id FROM vpc WHERE tags ->>'name' = '${prefix}-1') AND
      cidr_block = '192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the subnet change', commit());

  it(
    'confirms that subnet ACL has been set to default',
    query(
      `
    SELECT * FROM subnet WHERE vpc_id=(SELECT id FROM vpc WHERE tags ->>'name' = '${prefix}-1') AND
    cidr_block = '192.${randIPBlock}.0.0/16';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].network_acl_id).toBeNull();
      },
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'updates subnet to use a different acl',
    query(
      `
      UPDATE subnet SET network_acl_id = (SELECT id FROM network_acl WHERE tags ->> 'name' = '${prefix}-2') WHERE vpc_id=(SELECT id FROM vpc WHERE tags ->>'name' = '${prefix}-1') AND
      cidr_block = '192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the subnet change', commit());

  it(
    'confirms that subnet ACL has been replaced',
    query(
      `
    SELECT * FROM subnet WHERE vpc_id=(SELECT id FROM vpc WHERE tags ->>'name' = '${prefix}-1') AND
    cidr_block = '192.${randIPBlock}.0.0/16' AND network_acl_id=(SELECT id FROM network_acl WHERE  tags ->> 'name' = '${prefix}-2');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
      },
    ),
  );

  it('deletes subnet', begin());

  it(
    'deletes subnet',
    query(
      `  
    DELETE FROM subnet WHERE vpc_id=(SELECT id FROM vpc WHERE tags ->>'name' = '${prefix}-1') AND cidr_block = '192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies delete subnet', commit());

  it('updates ACL entries', begin());
  it(
    'updates ACL entries',
    query(
      `  
    UPDATE network_acl SET entries = '[{"CidrBlock":"10.0.0.0/0","Egress":true,"Protocol":"-1","RuleAction":"deny","RuleNumber":1},{"CidrBlock":"0.0.0.0/0","Egress":false,"Protocol":"-1","RuleAction":"deny","RuleNumber":2}]'
    WHERE  tags ->> 'name' = '${prefix}-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the ACL change', commit());

  it(
    'confirms that network ACL entries have been modified',
    query(
      `
    SELECT * FROM network_acl WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0]['entries']).toEqual(
          JSON.parse(
            `[{"CidrBlock": "0.0.0.0/0", "Egress": true, "Protocol": "-1", "RuleAction": "deny", "RuleNumber": 1}, {"CidrBlock": "0.0.0.0/0", "Egress": true, "Protocol": "-1", "RuleAction": "deny", "RuleNumber": 32767}, {"CidrBlock": "0.0.0.0/0", "Egress": false, "Protocol": "-1", "RuleAction": "deny", "RuleNumber": 2}, {"CidrBlock": "0.0.0.0/0", "Egress": false, "Protocol": "-1", "RuleAction": "deny", "RuleNumber": 32767}]`,
          ),
        );
      },
    ),
  );

  it('updates ACL tags', begin());

  it(
    'updates ACL tags',
    query(
      `  
    UPDATE network_acl SET tags = '{"name":"${prefix}-3"}' WHERE  tags ->> 'name' = '${prefix}-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the ACL change', commit());

  it(
    'confirms that network ACL tags have been modified',
    query(
      `
    SELECT * FROM network_acl WHERE tags ->> 'name' = '${prefix}-3';
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
      },
    ),
  );
  it('deletes network ACLs', begin());

  it(
    'deletes network ACLs',
    query(
      `  
    DELETE FROM network_acl WHERE tags ->> 'name' = '${prefix}-2' OR tags ->> 'name' = '${prefix}-3';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the ACL removal', commit());

  it(
    'confirms that network ACL tags have been removed',
    query(
      `
    SELECT * FROM network_acl WHERE tags ->> 'name' = '${prefix}-2' OR tags ->> 'name' = '${prefix}-3';
  `,
      (res: any[]) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'deletes the vpc',
    query(
      `
    DELETE FROM security_group_rule
    WHERE security_group_id = (
      SELECT id
      FROM security_group
      WHERE security_group.vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block = '191.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-2'
      )
    );
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE cidr_block = '191.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-2'
    )
    DELETE FROM security_group
    USING vpc
    WHERE vpc_id = vpc.id;

    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE cidr_block = '191.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-2'
    )
    DELETE FROM subnet
    USING vpc WHERE vpc_id = vpc.id;

    DELETE FROM vpc
    WHERE cidr_block = '191.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the vpc removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
