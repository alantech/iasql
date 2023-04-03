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

describe('VPC Integration Testing', () => {
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

  it(
    'adds a new vpc',
    query(
      `  
    INSERT INTO vpc (cidr_block)
    VALUES ('192.${randIPBlock}.0.0/16');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

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
    'check no vpc is pending',
    query(
      `
  SELECT * FROM vpc WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state!='available';
  `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check vpc is available',
    query(
      `
  SELECT * FROM vpc WHERE cidr_block='192.${randIPBlock}.0.0/16' AND state='available';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check vpc has tags',
    query(
      `
  SELECT * FROM vpc WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check vpc has the right attributes',
    query(
      `
  SELECT * FROM vpc WHERE tags ->> 'name' = '${prefix}-1' AND enable_dns_hostnames and enable_dns_support;
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'adds a subnet',
    query(
      `
    INSERT INTO subnet (availability_zone, vpc_id, cidr_block)
    SELECT (SELECT name FROM availability_zone WHERE region = '${region}' LIMIT 1), id, '192.${randIPBlock}.0.0/16'
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

  it('starts a transaction', begin());

  it(
    'updates vpc state',
    query(
      `
    UPDATE vpc
    SET state='pending' WHERE cidr_block='192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the state change of the vpc', commit());

  it(
    'checks that state has not been modified',
    query(
      `
    SELECT * FROM vpc WHERE cidr_block='192.${randIPBlock}.0.0/16'
    AND state='pending';
  `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'tries to update vpc tags',
    query(
      `
  UPDATE vpc SET tags = '{"name": "${prefix}-2"}' WHERE cidr_block='192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the vpc tags update', commit());

  itDocs(
    'checks that tags have been modified',
    query(
      `
    SELECT * FROM vpc WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-2';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());
  itDocs(
    'creates new DHCP options',
    query(
      `
      INSERT INTO dhcp_options (dhcp_configurations, tags) VALUES ('[{"Key":"domain-name","Values":[{"Value":"test-domain.com"}]},{"Key":"domain-name-servers","Values":[{"Value":"8.8.8.8"}]}]', '{"name":"${prefix}-1"}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the dhcp options creation', commit());

  itDocs(
    'checks addition of dhcp options',
    query(
      `
      SELECT *
      FROM dhcp_options 
      WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());
  itDocs(
    'associates option with VPC',
    query(
      `
      UPDATE vpc SET dhcp_options_id = (SELECT id FROM dhcp_options WHERE tags ->> 'name' = '${prefix}-1') WHERE tags ->> 'name' = '${prefix}-2';;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the dhcp options association', commit());

  itDocs(
    'checks that VPC has the correct dhcp options',
    query(
      `
      SELECT dhcp_options_id FROM vpc WHERE tags ->> 'name' = '${prefix}-2' AND dhcp_options_id = (SELECT id FROM dhcp_options WHERE tags ->> 'name' = '${prefix}-1');
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());
  itDocs(
    'sets the default dhcp options for the vpc',
    query(
      `
      UPDATE vpc SET dhcp_options_id = NULL WHERE tags ->> 'name' = '${prefix}-2';;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'deletes the dhcp options',
    query(
      `
      DELETE FROM dhcp_options WHERE tags ->> 'name' = '${prefix}-1';`,
    ),
  );
  it('applies the dhcp options removal', commit());

  itDocs(
    'checks removal of dhcp options',
    query(
      `
      SELECT *
      FROM dhcp_options 
      WHERE tags ->> 'name' = '${prefix}-1';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'tries to update vpc cidr',
    query(
      `
    UPDATE subnet SET cidr_block='191.${randIPBlock}.0.0/16' WHERE cidr_block='192.${randIPBlock}.0.0/16';
    UPDATE vpc SET cidr_block='191.${randIPBlock}.0.0/16' WHERE cidr_block='192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the vpc cidr update', commit());

  itDocs(
    'checks that cidr have been modified',
    query(
      `
  SELECT * FROM vpc WHERE cidr_block='191.${randIPBlock}.0.0/16';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the vpc module', uninstall(modules));

  it('installs the vpc module again (to make sure it reloads stuff)', install(modules));

  it(
    'queries the vpcs to confirm the record is present',
    query(
      `
    SELECT * FROM vpc WHERE cidr_block = '191.${randIPBlock}.0.0/16'
  `,
      (res: any) => expect(res.length).toBeGreaterThan(0),
    ),
  );

  it('starts a transaction', begin());
  itDocs(
    'creates a second vpc in another region',
    query(
      `
      INSERT INTO vpc (cidr_block, tags, enable_dns_hostnames, enable_dns_support, region)
      VALUES ('176.${randIPBlock}.0.0/16', '{"name":"${prefix}-peering-vpc"}', true, true, 'us-east-1');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  itDocs(
    'adds a subnet to the vpc',
    query(
      `
      INSERT INTO subnet (availability_zone, vpc_id, cidr_block, region)
      SELECT 'us-east-1a', id, '176.${randIPBlock}.1.0/24', 'us-east-1'
      FROM vpc
      WHERE tags ->> 'name' = '${prefix}-peering-vpc';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the creation of the second vpc', commit());

  it('starts a transaction', begin());
  itDocs(
    'creates a peering connection between the first and second vpc',
    query(
      `
      INSERT INTO peering_connection (requester_id, accepter_id, tags)
      VALUES ((SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-2'),
              (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-peering-vpc'),
              '{"name": "${prefix}-peering-connection-test"}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies creation of the peering connection', commit());

  itDocs(
    'checks the state for peering connection is active',
    query(
      `
      SELECT state
      FROM peering_connection
      WHERE tags ->> 'name' = '${prefix}-peering-connection-test';
  `,
      (res: any) => expect(res[0].state).toBe('active'),
    ),
  );

  itDocs(
    'checks if routes from requester to accepter is added',
    query(
      `
          SELECT destination
          FROM route
          WHERE vpc_peering_connection_id = (SELECT peering_connection_id
                                             FROM peering_connection
                                             WHERE tags ->> 'name' = '${prefix}-peering-connection-test');
      `,
      (res: { destination: string }[]) => {
        expect(res.length).toBe(2);
      },
    ),
  );

  it('starts a transaction', begin());
  itDocs(
    'changes the tags for the peering connection',
    query(
      `
      UPDATE peering_connection
      SET tags = '{"name": "${prefix}-peering-connection-test-changed"}'
      WHERE tags ->> 'name' = '${prefix}-peering-connection-test';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies creation of the peering connection', commit());

  itDocs(
    'checks the peering connection tags are changed',
    query(
      `
      SELECT *
      FROM peering_connection
      WHERE tags ->> 'name' = '${prefix}-peering-connection-test-changed';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());
  it(
    'tries to change the peering connection state',
    query(
      `
      UPDATE peering_connection
      SET state = 'expired'
      WHERE tags ->> 'name' = '${prefix}-peering-connection-test-changed';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the change of peering connection state', commit());

  it(
    'verifies the rollback of the peering connection state change',
    query(
      `
      SELECT state
      FROM peering_connection
      WHERE tags ->> 'name' = '${prefix}-peering-connection-test-changed';
  `,
      (res: any) => expect(res[0].state).toBe('active'),
    ),
  );

  it('starts a transaction', begin());
  itDocs(
    'deletes the peering connection',
    query(
      `
      DELETE
      FROM peering_connection
      WHERE tags ->> 'name' = '${prefix}-peering-connection-test-changed';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the deletion of peering connection', commit());

  it('starts a transaction', begin());
  it(
    'deletes the second vpc',
    query(
      `
      DELETE FROM security_group_rule
      WHERE security_group_id = (
          SELECT id
          FROM security_group
          WHERE vpc_id = (
              SELECT id
              FROM vpc
              WHERE cidr_block = '176.${randIPBlock}.0.0/16'
                AND tags ->> 'name' = '${prefix}-peering-vpc'
          )
      );
      WITH vpc as (SELECT id
                   FROM vpc
                   WHERE cidr_block = '176.${randIPBlock}.0.0/16'
                     AND tags ->> 'name' = '${prefix}-peering-vpc')
      DELETE
      FROM security_group
          USING vpc
      WHERE vpc_id = vpc.id;

      WITH vpc as (
          SELECT id
          FROM vpc
          WHERE cidr_block = '176.${randIPBlock}.0.0/16'
            AND tags ->> 'name' = '${prefix}-peering-vpc'
      )
      DELETE FROM subnet
          USING vpc
      WHERE vpc_id = vpc.id;

      DELETE
      FROM vpc
      WHERE cidr_block = '176.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the deletion of the second vpc and peering connection', commit());

  itDocs(
    'checks deletion of the peering connection',
    query(
      `
      SELECT *
      FROM peering_connection
      WHERE tags ->> 'name' = '${prefix}-peering-connection-test';
  `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  itDocs(
    'deletes the subnet',
    query(
      `
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE is_default = false
      AND cidr_block = '191.${randIPBlock}.0.0/16'
    )
    DELETE FROM subnet
    USING vpc
    WHERE vpc_id = vpc.id;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the subnet removal', commit());

  it('starts a transaction', begin());

  itDocs(
    'deletes the vpc',
    query(
      `
    DELETE FROM security_group_rule
    WHERE security_group_id = (
      SELECT id
      FROM security_group
      WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block = '191.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-2'
      )
    );
    DELETE FROM route_table_association
    WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block = '191.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-2'
    );
    DELETE FROM route_table
    WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block = '191.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-2'
    );
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE cidr_block = '191.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-2'
    )
    DELETE FROM security_group
    USING vpc
    WHERE vpc_id = vpc.id;

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

describe('VPC install/uninstall', () => {
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
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the VPC module', install(modules));

  it('uninstalls the VPC module', uninstall(modules));

  it('installs all modules', installAll());

  it(
    'uninstalls the VPC module',
    uninstall([
      'aws_vpc',
      'aws_ecs_fargate',
      'aws_ecs_simplified',
      'aws_security_group',
      'aws_rds',
      'aws_elb',
      'aws_ec2',
      'aws_ec2_metadata',
      'aws_route53',
      'aws_memory_db',
      'aws_acm',
      'aws_codedeploy',
      'aws_codepipeline',
      'aws_lambda',
      'aws_cloudfront',
      'aws_opensearch',
    ]),
  );

  it('installs the VPC module', install(['aws_vpc']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
