import config from '../../src/config';
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
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'vpctest';
const ng = `${prefix}${dbAlias}-ng`;
const pubNg1 = `${prefix}${dbAlias}-pub-ng1`;
const pubNg2 = `${prefix}${dbAlias}-pub-ng2`;
const eip = `${prefix}${dbAlias}-eip`;
const s3VpcEndpoint = `${prefix}${dbAlias}-s3-vpce`;
const lambdaVpcEndpoint = `${prefix}${dbAlias}-lambda-vpce`;
const dynamodbVpcEndpoint = `${prefix}${dbAlias}-dynamodb-vpce`;
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
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
// We have to install the `aws_security_group` to test fully the integration even though is not being used,
// since the `aws_vpc` module creates a `default` security group automatically.
const modules = ['aws_vpc', 'aws_security_group'];

const availabilityZone = `${region}a`;
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
    SELECT '${availabilityZone}', id, '192.${randIPBlock}.0.0/16'
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

  it(
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

  it(
    'checks that tags have been modified',
    query(
      `
    SELECT * FROM vpc WHERE cidr_block='192.${randIPBlock}.0.0/16' AND tags ->> 'name' = '${prefix}-2';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
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

  it(
    'checks that cidr have been modified',
    query(
      `
  SELECT * FROM vpc WHERE cidr_block='191.${randIPBlock}.0.0/16';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  describe('Elastic IP and nat gateway creation', () => {
    it('starts a transaction', begin());

    it(
      'adds a new elastic ip',
      query(
        `
      INSERT INTO elastic_ip (tags)
      VALUES ('{"name": "${eip}"}');
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it(
      'check elastic ip count',
      query(
        `
      SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it('applies the elastic ip change', commit());

    it(
      'check elastic ip count',
      query(
        `
      SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it('starts a transaction', begin());

    it(
      'adds a private nat gateway',
      query(
        `
      INSERT INTO nat_gateway (connectivity_type, subnet_id, tags)
      SELECT 'private', id, '{"Name":"${ng}"}'
      FROM subnet
      WHERE cidr_block = '191.${randIPBlock}.0.0/16';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the private nat gateway change', commit());

    it(
      'checks private nat gateway count',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it('starts a transaction', begin());

    it(
      'adds a public nat gateway with existing elastic ip',
      query(
        `
      INSERT INTO nat_gateway (connectivity_type, subnet_id, tags, elastic_ip_id)
      SELECT 'public', subnet.id, '{"Name":"${pubNg1}"}', elastic_ip.id
      FROM subnet, elastic_ip
      WHERE cidr_block = '191.${randIPBlock}.0.0/16' AND elastic_ip.tags ->> 'name' = '${eip}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the public nat gateway with existing elastic ip change', commit());

    it(
      'checks public nat gateway with existing elastic ip count',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg1}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it('starts a transaction', begin());

    it(
      'adds a public nat gateway with no existing elastic ip',
      query(
        `
      INSERT INTO nat_gateway (connectivity_type, subnet_id, tags)
      SELECT 'public', subnet.id, '{"Name":"${pubNg2}"}'
      FROM subnet
      WHERE cidr_block = '191.${randIPBlock}.0.0/16';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the public nat gateway with no existing elastic ip change', commit());

    it(
      'checks public nat gateway with no existing elastic ip count',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg2}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it(
      'checks elastic IP count',
      query(
        `

      SELECT * FROM elastic_ip WHERE tags ->> 'Name' = '${pubNg2}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );
  });

  describe('VPC endpoint gateway creation', () => {
    it('starts a transaction', begin());

    it(
      'adds a new s3 endpoint gateway',
      query(
        `
      INSERT INTO endpoint_gateway (service, vpc_id, tags)
      SELECT 's3', id, '{"Name": "${s3VpcEndpoint}"}'
      FROM vpc
      WHERE is_default = false
      AND cidr_block = '191.${randIPBlock}.0.0/16';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it(
      'checks endpoint gateway count',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it('applies the endpoint gateway change', commit());

    it(
      'checks endpoint gateway count',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );
  });

  describe('VPC endpoint interface creation', () => {
    it('starts a transaction', begin());

    it(
      'adds a new lambda endpoint interface',
      query(
        `
      INSERT INTO endpoint_interface (service, vpc_id, tags)
      SELECT 'lambda', id, '{"Name": "${lambdaVpcEndpoint}"}'
      FROM vpc
      WHERE is_default = false
      AND cidr_block = '191.${randIPBlock}.0.0/16';
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
  });

  it('uninstalls the vpc module', uninstall(modules));

  it('installs the vpc module again (to make sure it reloads stuff)', install(modules));

  it(
    'checks private nat gateway count',
    query(
      `
    SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks public nat gateway with existing elastic ip count',
    query(
      `
    SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg1}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks public nat gateway with no existing elastic ip count',
    query(
      `
    SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg2}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'queries the vpcs to confirm the record is present',
    query(
      `
    SELECT * FROM vpc WHERE cidr_block = '191.${randIPBlock}.0.0/16'
  `,
      (res: any) => expect(res.length).toBeGreaterThan(0),
    ),
  );

  it(
    'checks endpoint gateway count',
    query(
      `
    SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
  `,
      (res: any) => expect(res.length).toBe(1),
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

  describe('Elastic Ip and Nat gateway updates', () => {
    it('starts a transaction', begin());

    it(
      'updates a elastic ip',
      query(
        `
      UPDATE elastic_ip
      SET tags = '{"name": "${eip}", "updated": "true"}'
      WHERE tags ->> 'name' = '${eip}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the elastic ip change', commit());

    it(
      'check elastic ip count',
      query(
        `
      SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it(
      'checks elastic ip update',
      query(
        `
      SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
    `,
        (res: any) => expect(res[0]['tags']['updated']).toBe('true'),
      ),
    );

    it('starts a transaction', begin());

    it(
      'updates a public nat gateway with existing elastic ip to be private',
      query(
        `
      UPDATE nat_gateway
      SET elastic_ip_id = NULL, connectivity_type = 'private'
      WHERE nat_gateway.tags ->> 'Name' = '${pubNg1}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the public nat gateway with existing elastic ip to be private change', commit());

    it(
      'checks public nat gateway with existing elastic ip to be private count',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg1}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it(
      'checks public nat gateway with existing elastic ip to be private update',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg1}';
    `,
        (res: any) => expect(res[0]['connectivity_type']).toBe('private'),
      ),
    );

    it('starts a transaction', begin());

    it(
      'updates a public nat gateway with no existing elastic ip',
      query(
        `
      UPDATE nat_gateway
      SET elastic_ip_id = elastic_ip.id, tags = '{"Name": "${pubNg2}", "updated": "true"}'
      FROM elastic_ip
      WHERE nat_gateway.tags ->> 'Name' = '${pubNg2}' AND elastic_ip.tags ->> 'name' = '${eip}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the public nat gateway with no existing elastic ip change', commit());

    it(
      'checks public nat gateway with no existing elastic ip count',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg2}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it(
      'checks public nat gateway with no existing elastic ip update',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg2}';
    `,
        (res: any) => expect(res[0]['tags']['updated']).toBe('true'),
      ),
    );
  });

  describe('VPC endpoint gateway updates', () => {
    it('starts a transaction', begin());

    it(
      'updates a endpoint gateway to be restored',
      query(
        `
      UPDATE endpoint_gateway
      SET state = 'fake'
      WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the endpoint_gateway change', commit());

    it(
      'checks endpoint_gateway count',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it(
      'checks endpoint_gateway restored',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        (res: any) => expect(res[0]['state']).toBe('available'),
      ),
    );

    it('starts a transaction', begin());

    it(
      'updates a endpoint gateway policy',
      query(
        `
      UPDATE endpoint_gateway
      SET policy_document = '${testPolicy}'
      WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the endpoint_gateway change', commit());

    it(
      'checks endpoint_gateway count',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it(
      'checks endpoint_gateway policy update',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        (res: any) => expect(res[0]['policy_document']).toBe(testPolicy),
      ),
    );

    it('starts a transaction', begin());

    it(
      'updates a endpoint gateway tags',
      query(
        `
      UPDATE endpoint_gateway
      SET tags = '{"Name": "${s3VpcEndpoint}", "updated": "true"}'
      WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the endpoint_gateway change', commit());

    it(
      'checks endpoint_gateway count',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it(
      'checks endpoint_gateway policy update',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        (res: any) => expect(res[0]['tags']['updated']).toBe('true'),
      ),
    );

    it('starts a transaction', begin());

    it(
      'updates a endpoint gateway to be replaced',
      query(
        `
      UPDATE endpoint_gateway
      SET service = 'dynamodb', tags = '{"Name": "${dynamodbVpcEndpoint}"}'
      WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the endpoint_gateway change', commit());

    it(
      'checks endpoint_gateway count',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${s3VpcEndpoint}';
    `,
        (res: any) => expect(res.length).toBe(0),
      ),
    );

    it(
      'checks endpoint_gateway count',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${dynamodbVpcEndpoint}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );
  });

  describe('VPC endpoint interface updates', () => {
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

    it(
      'AUDIT',
      query(
        `
      select * from iasql_audit_log order by ts desc limit 5;
    `,
        (res: any) => {
          console.log(`+-+ audit logs = ${JSON.stringify(res)}`);
          expect(res.length).toBe(5);
        },
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
      (SELECT subnet.id FROM subnet INNER JOIN vpc ON vpc.id=subnet.vpc_id WHERE subnet.cidr_block='191.${randIPBlock}.0.0/16' AND vpc.tags ->> 'name' = '${prefix}-2' LIMIT 1))
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
  });

  describe('Elastic Ip and Nat gateway deletion', () => {
    it('starts a transaction', begin());

    it(
      'deletes a public nat gateways',
      query(
        `
      DELETE FROM nat_gateway
      WHERE tags ->> 'Name' = '${pubNg1}' OR tags ->> 'Name' = '${pubNg2}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the public nat gateways change', commit());

    it(
      'checks public nat gateways count',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${pubNg1}' OR tags ->> 'Name' = '${pubNg2}'
    `,
        (res: any) => expect(res.length).toBe(0),
      ),
    );

    it('starts a transaction', begin());

    it(
      'deletes a elastic ip created by the nat gateway',
      query(
        `
      DELETE FROM elastic_ip
      WHERE tags ->> 'Name' = '${pubNg2}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the elastic ip created by the nat gateway change', commit());

    it(
      'check elastic ip created by the nat gateway count',
      query(
        `
      SELECT * FROM elastic_ip WHERE tags ->> 'Name' = '${pubNg2}';
    `,
        (res: any) => expect(res.length).toBe(0),
      ),
    );

    it('starts a transaction', begin());

    it(
      'deletes a elastic ip',
      query(
        `
      DELETE FROM elastic_ip
      WHERE tags ->> 'name' = '${eip}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the elastic ip change', commit());

    it(
      'check elastic ip count',
      query(
        `
      SELECT * FROM elastic_ip WHERE tags ->> 'name' = '${eip}';
    `,
        (res: any) => expect(res.length).toBe(0),
      ),
    );

    it('starts a transaction', begin());

    it(
      'updates a private nat gateway',
      query(
        `
      UPDATE nat_gateway
      SET state = 'failed'
      WHERE tags ->> 'Name' = '${ng}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the private nat gateway change', commit());

    it(
      'checks private nat gateway count',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
    `,
        (res: any) => expect(res.length).toBe(1),
      ),
    );

    it(
      'checks private nat gateway state',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
    `,
        (res: any) => expect(res[0]['state']).toBe('available'),
      ),
    );

    it('starts a transaction', begin());

    it(
      'deletes a private nat gateway',
      query(
        `
      DELETE FROM nat_gateway
      WHERE tags ->> 'Name' = '${ng}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the private nat gateway change', commit());

    it(
      'checks private nat gateway count',
      query(
        `
      SELECT * FROM nat_gateway WHERE tags ->> 'Name' = '${ng}';
    `,
        (res: any) => expect(res.length).toBe(0),
      ),
    );
  });

  describe('VPC endpoint gateway deletion', () => {
    it('starts a transaction', begin());

    it(
      'deletes a endpoint_gateway',
      query(
        `
      DELETE FROM endpoint_gateway
      WHERE tags ->> 'Name' = '${dynamodbVpcEndpoint}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the endpoint_gateway change', commit());

    it(
      'checks endpoint_gateway count',
      query(
        `
      SELECT * FROM endpoint_gateway WHERE tags ->> 'Name' = '${dynamodbVpcEndpoint}' OR tags ->> 'Name' = '${s3VpcEndpoint}'
    `,
        (res: any) => expect(res.length).toBe(0),
      ),
    );
  });

  describe('VPC endpoint interface deletion', () => {
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
  });

  it('starts a transaction', begin());

  it(
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

  it('installs all modules', done =>
    void iasql.install([], dbAlias, config.db.user, true).then(...finish(done)));

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
    ]),
  );

  it('installs the VPC module', install(['aws_vpc']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
