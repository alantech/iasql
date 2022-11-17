import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runCommit,
  runInstall,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = 'lambdatest';
const lambdaFunctionName = `${prefix}${dbAlias}`;
// Base64 for zip file with the following code:
// exports.handler =  async function(event, context) {
//   console.log("EVENT: \n" + JSON.stringify(event, null, 2))
//   return context.logStreamName
// }
const lambdaFunctionCode =
  'UEsDBBQAAAAIADqB9VRxjjIufQAAAJAAAAAIABwAaW5kZXguanNVVAkAAzBe2WIwXtlidXgLAAEE9QEAAAQUAAAANcyxDoIwEIDhnae4MNFIOjiaOLI41AHj5NLUA5scV3K9Gojx3ZWB8R++H5c5iWb78vwkFDgD+LxygKFw0Ji4wTeythASKy5q4FPBFjkRWkpjU3f3zt1O8OAaDnDpr85mlchjHNYdcyFq4WjM3wpqEd5/26JXQT85P2H1/QFQSwECHgMUAAAACAA6gfVUcY4yLn0AAACQAAAACAAYAAAAAAABAAAApIEAAAAAaW5kZXguanNVVAUAAzBe2WJ1eAsAAQT1AQAABBQAAABQSwUGAAAAAAEAAQBOAAAAvwAAAAAA';
// Base64 for zip file with the following code:
// exports.handler =  async function(event, context) {
//   console.log("EVENT: \n" + JSON.stringify(event, null, 3))
//   return context.logStreamName
// }
const lambdaFunctionCodeUpdate =
  'UEsDBBQAAAAIAI2Y9lTkWkK7fQAAAJAAAAAIABwAaW5kZXguanNVVAkAA5rY2mKc2NpidXgLAAEE9QEAAAQUAAAANcyxDoIwEIDhnae4MNFIuriZOLI41AHj5NLUA5scV3K9Gojx3ZWB8R++H5c5iWb78vwkFDgD+LxygKFw0Ji4wTeythASKy5q4FPBFjkRWkpjU3f3zt1O8OAaDnDpr85mlchjHNYdcyFq4WjM3wpqEd5/26JXQT85P2H1/QFQSwECHgMUAAAACACNmPZU5FpCu30AAACQAAAACAAYAAAAAAABAAAApIEAAAAAaW5kZXguanNVVAUAA5rY2mJ1eAsAAQT1AQAABBQAAABQSwUGAAAAAAEAAQBOAAAAvwAAAAAA';
const lambdaFunctionHandler = 'index.handler';
const lambdaFunctionRuntime14 = 'nodejs14.x';
const lambdaFunctionRuntime16 = 'nodejs16.x';
const lambdaFunctionRoleName = `${prefix}${dbAlias}-role`;
const lambdaFunctionRoleTaskPolicyArn = 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole';
const lambdaVpcFunctionRoleTaskPolicyArn =
  'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole';

const attachAssumeLambdaPolicy = JSON.stringify({
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
const sgGroupName = `${prefix}sglambda`;

const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_lambda'];

const availabilityZone = `${region}a`;
const randIPBlock = Math.floor(Math.random() * 254) + 1; // 0 collides with the default CIDR block

jest.setTimeout(480000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('Lambda Integration Testing', () => {
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

  it('installs the lambda module', install(modules));

  it(
    'adds a new security group',
    query(
      `  
    INSERT INTO security_group (description, group_name)
    VALUES ('Lambda Security Group', '${sgGroupName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds security group rules',
    query(
      `
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT false, 'tcp', 80, 80, '0.0.0.0/0', '${prefix}lambda_rule_http', id
    FROM security_group
    WHERE group_name = '${sgGroupName}';
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT true, 'tcp', 1, 65335, '0.0.0.0/0', '${prefix}lambda_rule_egress', id
    FROM security_group
    WHERE group_name = '${sgGroupName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the security group and rules creation', commit());

  it(
    'adds a new lambda function and role',
    query(
      `
    BEGIN;
      INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
      VALUES ('${lambdaFunctionRoleName}', '${attachAssumeLambdaPolicy}', array['${lambdaFunctionRoleTaskPolicyArn}', '${lambdaVpcFunctionRoleTaskPolicyArn}']);

      INSERT INTO lambda_function (name, zip_b64, handler, runtime, role_name)
      VALUES ('${lambdaFunctionName}', '${lambdaFunctionCode}', '${lambdaFunctionHandler}', '${lambdaFunctionRuntime14}', '${lambdaFunctionRoleName}');
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'check function insertion',
    query(
      `
    SELECT *
    FROM lambda_function
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'adds a new lambda role',
    query(
      `
      INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
      VALUES ('${lambdaFunctionRoleName}', '${attachAssumeLambdaPolicy}', array['${lambdaFunctionRoleTaskPolicyArn}', '${lambdaVpcFunctionRoleTaskPolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the iam role creation', commit());

  it(
    'adds a new lambda function',
    query(
      `
    BEGIN;
      INSERT INTO lambda_function (name, zip_b64, handler, runtime, subnets, role_name)
      VALUES ('${lambdaFunctionName}', '${lambdaFunctionCode}', '${lambdaFunctionHandler}', '${lambdaFunctionRuntime14}', (select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where is_default = true and vpc.region = '${region}' limit 3)), '${lambdaFunctionRoleName}');

      INSERT INTO lambda_function_security_groups (lambda_function_id, security_group_id)
      VALUES ((SELECT id FROM lambda_function WHERE name = '${lambdaFunctionName}'), (select id from security_group where group_name = '${sgGroupName}' and region = '${region}' limit 1));

    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda function change', commit());

  it(
    'check function insertion',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );
  it(
    'check security group insertion',
    query(
      `
    SELECT *
    FROM lambda_function_security_groups
    WHERE lambda_function_id=(SELECT id FROM lambda_function WHERE name = '${lambdaFunctionName}');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Invoke Lambda function
  it(
    'invoke lambda',
    query(
      `
      SELECT *
      FROM invoke_lambda('${lambdaFunctionName}', '{"name": "test"}');
    `,
      (res: any[]) => {
        console.log(res[0]);
        expect(res[0]['status']).toBe('200');
        return expect(res.length).toBe(1);
      },
    ),
  );

  it('should fail when invoking without function name', done =>
    void query(`
    SELECT *
    FROM invoke_lambda();
  `)((e?: any) => {
      try {
        expect(e?.message).toContain('Please provide a valid lambda function name');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it('should fail invoking with wrong payload', done =>
    void query(`
      SELECT *
      FROM invoke_lambda('${lambdaFunctionName}', '{name: test}');
  `)((e?: any) => {
      try {
        expect(e?.message).toContain('The payload must be a valid JSON string');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  // Check restore path
  it(
    'updates the function arn',
    query(
      `
    UPDATE lambda_function SET arn = 'fake' WHERE name = '${lambdaFunctionName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda function update', commit());

  it(
    'check lambda function is restored',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND arn = 'fake';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check lambda function does still exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Check subnet modification
  it(
    'adds a new vpc',
    query(
      `  
    INSERT INTO vpc (cidr_block, tags, enable_dns_hostnames, enable_dns_support, region)
    VALUES ('192.${randIPBlock}.0.0/16', '{"name":"${prefix}-1"}', true, true, '${region}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a subnet',
    query(
      `
    INSERT INTO subnet (availability_zone, vpc_id, cidr_block, region)
    SELECT '${availabilityZone}', id, '192.${randIPBlock}.0.0/16', '${region}'
    FROM vpc
    WHERE cidr_block = '192.${randIPBlock}.0.0/16' and region='${region}' limit 1;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the vpc and subnet creation', commit());

  it(
    'adds a new security group with non-default vpc',
    query(
      `  
    INSERT INTO security_group (description, group_name, vpc_id)
    VALUES ('Lambda security group for non-default vpc', '${prefix}lambdanotdefault', (SELECT id FROM vpc WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region='${region}' limit 1));
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds security group rules for not default',
    query(
      `
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT false, 'tcp', 80, 80, '0.0.0.0/0', '${prefix}lambda_rule_http_not_default', id
    FROM security_group
    WHERE group_name = '${prefix}lambdanotdefault';
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT true, 'tcp', 1, 65335, '0.0.0.0/0', '${prefix}lambda_rule_egress_not_default', id
    FROM security_group
    WHERE group_name = '${prefix}lambdanotdefault';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the not default security group and rules creation', commit());

  it(
    'updates the function subnets',
    query(
      `
    UPDATE lambda_function SET subnets = (select array(select subnet_id from subnet inner join vpc on vpc.id = subnet.vpc_id where vpc.region = '${region}' and subnet.cidr_block='192.${randIPBlock}.0.0/16'))
    WHERE name = '${lambdaFunctionName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'updates the security groups',
    query(
      `
    UPDATE lambda_function_security_groups SET security_group_id=(select id from security_group where group_name='${prefix}lambdanotdefault' and region='${region}' limit 1) where lambda_function_id=
    (select id from lambda_function where name='${lambdaFunctionName}' AND region='${region}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda subnet and security group function update', commit());

  it(
    'check subnets after modification',
    query(
      `
      SELECT * FROM lambda_function 
      WHERE name = '${lambdaFunctionName}' AND cardinality(subnets)=1;      
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Check configuration update path
  it(
    'updates the function',
    query(
      `
    UPDATE lambda_function SET runtime = '${lambdaFunctionRuntime16}' WHERE name = '${lambdaFunctionName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda function update', commit());

  it(
    'check lambda function is updated',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND runtime = '${lambdaFunctionRuntime14}' ;
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check lambda function does still exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Check code update path
  it(
    'updates the function',
    query(
      `
    UPDATE lambda_function SET zip_b64 = '${lambdaFunctionCodeUpdate}' WHERE name = '${lambdaFunctionName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda function update', commit());

  it(
    'check lambda function is updated',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND zip_b64 is NULL;
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check lambda function does still exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  // Check tags update path
  it(
    'updates the function',
    query(
      `
    UPDATE lambda_function SET tags = '{"updated": "true"}' WHERE name = '${lambdaFunctionName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the lambda function update', commit());

  it(
    'check lambda function is updated',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}' AND tags ->> 'updated' = 'true';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check lambda function does still exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the lambda module', uninstall(modules));

  it('installs the lambda module', install(modules));

  it(
    'deletes the lambda function',
    query(
      `
      BEGIN;
      DELETE FROM lambda_function_security_groups
      WHERE lambda_function_id = (SELECT id FROM lambda_function WHERE name = '${lambdaFunctionName}');
  
    DELETE FROM lambda_function WHERE name = '${lambdaFunctionName}';
    COMMIT;

  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check lambda function does not exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the lambda function removal', commit());

  it(
    'check lambda function does not exist',
    query(
      `
    SELECT *
    FROM lambda_function 
    WHERE name = '${lambdaFunctionName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'deletes the lambda function role',
    query(
      `
    DELETE FROM iam_role WHERE role_name = '${lambdaFunctionRoleName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check lambda function role does not exists',
    query(
      `
    SELECT *
    FROM iam_role 
    WHERE role_name = '${lambdaFunctionRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the lambda function role removal', commit());

  it(
    'check lambda function role does not exist',
    query(
      `
    SELECT *
    FROM iam_role 
    WHERE role_name = '${lambdaFunctionRoleName}';
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'deletes security group rules',
    query(
      `
      DELETE FROM security_group_rule WHERE description='${prefix}lambda_rule_http' or description='${prefix}lambda_rule_egress' AND region='${region}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'deletes security group',
    query(
      `
      DELETE FROM security_group WHERE group_name = '${sgGroupName}' AND region='${region}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the security group deletion', commit());

  it(
    'deletes the subnet and security groups',
    query(
      `
    WITH vpc as (
      SELECT id
      FROM vpc
      WHERE cidr_block = '192.${randIPBlock}.0.0/16' AND region='${region}'
    )
    DELETE FROM subnet
    USING vpc
    WHERE subnet.vpc_id = vpc.id;

    DELETE FROM security_group_rule WHERE description='${prefix}lambda_rule_http_not_default' or description='${prefix}lambda_rule_egress_not_default' AND region='${region}';

    DELETE FROM security_group WHERE group_name = '${prefix}lambdanotdefault' AND region='${region}';

    DELETE FROM security_group
    USING vpc
    WHERE security_group.vpc_id = vpc.id;

    DELETE FROM vpc WHERE cidr_block='192.${randIPBlock}.0.0/16' AND region='${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the subnet removal', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('Lambda install/uninstall', () => {
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

  it(
    'installs the Lambda module and confirms two tables are created',
    query(
      `
    select * from iasql_install('aws_lambda');
  `,
      (res: any[]) => {
        expect(res.length).toBe(2);
      },
    ),
  );

  it(
    'uninstalls the Lambda module and confirms two tables are removed',
    query(
      `
    select * from iasql_uninstall('aws_lambda');
  `,
      (res: any[]) => {
        expect(res.length).toBe(2);
      },
    ),
  );

  it('installs all modules', done =>
    void iasql.install([], dbAlias, config.db.user, true).then(...finish(done)));

  it('uninstalls the lambda module', uninstall(modules));

  it('installs the lambda module', install(modules));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
