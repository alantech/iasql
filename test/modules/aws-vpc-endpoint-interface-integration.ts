import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runBegin,
  runCommit,
  runInstall,
  runQuery,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'vpctest';
const lambdaVpcEndpoint = `${prefix}${dbAlias}-lambda-vpce`;
const testPolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: {
        Service: 'lambda.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
});

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
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

describe('VPC Endpoint interface Integration Testing', () => {
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

  it('installs the vpc module', install(modules));

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

  it(
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
    'adds a new lambda endpoint interface',
    query(
      `
    INSERT INTO endpoint_interface (service, vpc_id, tags)
    SELECT 'lambda', id, '{"Name": "${lambdaVpcEndpoint}"}'
    FROM vpc
    WHERE is_default = false
    AND cidr_block = '192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'checks endpoint interface count',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('applies the endpoint interface creation', commit());

  it(
    'checks endpoint interface count',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );
  it(
    'checks endpoint interface default subnet count',
    query(
      `
    SELECT * FROM endpoint_interface_subnets WHERE endpoint_interface_id=(SELECT id FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}');
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the vpc module', uninstall(modules));

  it('installs the vpc module again (to make sure it reloads stuff)', install(modules));

  it(
    'checks endpoint interface count',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'queries the vpcs to confirm the record is present',
    query(
      `
    SELECT * FROM vpc WHERE cidr_block = '192.${randIPBlock}.0.0/16'
  `,
      (res: any) => expect(res.length).toBeGreaterThan(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'updates a endpoint interface to be restored',
    query(
      `
    UPDATE endpoint_interface
    SET state = 'fake'
    WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the endpoint_interface change', commit());

  it(
    'checks endpoint_interface count',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks endpoint_interface restored',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      (res: any) => expect(res[0]['state']).toBe('available'),
    ),
  );

  it('starts a transaction', begin());

  it(
    'updates a endpoint interface policy',
    query(
      `
    UPDATE endpoint_interface
    SET policy_document = '${testPolicy}'
    WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the endpoint_interface change', commit());

  it(
    'checks endpoint_interface count',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks endpoint_interface policy update',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      (res: any) => expect(res[0]['policy_document']).toBe(testPolicy),
    ),
  );

  it('starts a transaction', begin());

  it(
    'updates a endpoint interface tags',
    query(
      `
    UPDATE endpoint_interface
    SET tags = '{"Name": "${lambdaVpcEndpoint}", "updated": "true"}'
    WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the endpoint_interface change', commit());

  it(
    'checks endpoint_interface count',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks endpoint_interface policy update',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      (res: any) => expect(res[0]['tags']['updated']).toBe('true'),
    ),
  );

  it('starts a transaction', begin());

  it(
    'removes the current endpoint subnets',
    query(
      `
    DELETE FROM endpoint_interface_subnets where endpoint_interface_id=(SELECT id FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}')
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the endpoint_interface subnet removal', commit());

  it(
    'checks endpoint_interface subnet count',
    query(
      `
    SELECT * FROM endpoint_interface_subnets WHERE endpoint_interface_id=(SELECT id FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}');
  `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'adds new endpoint subnet',
    query(
      `
    INSERT INTO endpoint_interface_subnets (endpoint_interface_id, subnet_id) VALUES ((SELECT id FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}' LIMIT 1),
    (SELECT subnet.id FROM subnet INNER JOIN vpc ON vpc.id=subnet.vpc_id WHERE subnet.cidr_block='192.${randIPBlock}.0.0/16' LIMIT 1))
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the endpoint_interface subnet change', commit());

  it(
    'checks endpoint_interface subnet count',
    query(
      `
    SELECT * FROM endpoint_interface_subnets WHERE endpoint_interface_id=(SELECT id FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}');
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes a endpoint_interface',
    query(
      `
    DELETE FROM endpoint_interface
    WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the endpoint_interface change', commit());

  it(
    'checks endpoint_interface count',
    query(
      `
    SELECT * FROM endpoint_interface WHERE tags ->> 'Name' = '${lambdaVpcEndpoint}'
  `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());

  it(
    'deletes the subnet',
    query(
      `
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE is_default = false
      AND cidr_block = '192.${randIPBlock}.0.0/16'
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

  it(
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
        WHERE cidr_block = '192.${randIPBlock}.0.0/16'
      )
    );
    DELETE FROM route_table_association
    WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block = '192.${randIPBlock}.0.0/16'
    );
    DELETE FROM route
    WHERE route_table_id = (
        SELECT id
        FROM route_table
        WHERE vpc_id = (
          SELECT id
          FROM vpc
          WHERE cidr_block = '192.${randIPBlock}.0.0/16'
      )
    );
    DELETE FROM route_table
    WHERE vpc_id = (
        SELECT id
        FROM vpc
        WHERE cidr_block = '192.${randIPBlock}.0.0/16'
    );
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE cidr_block = '192.${randIPBlock}.0.0/16'
    )
    DELETE FROM security_group
    USING vpc
    WHERE vpc_id = vpc.id;

    DELETE FROM vpc
    WHERE cidr_block = '192.${randIPBlock}.0.0/16';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the vpc removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
