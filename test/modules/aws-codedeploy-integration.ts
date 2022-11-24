import { EC2 } from '@aws-sdk/client-ec2';

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
const dbAlias = 'codedeploytest';
const applicationName = `${prefix}${dbAlias}application`;
const applicationNameForDeployment = `${prefix}${dbAlias}applicationForDeployment`;
const deploymentGroupName = `${prefix}${dbAlias}deployment_group`;
const ubuntuAmiId =
  'resolve:ssm:/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id';

const nonDefaultRegion = 'us-east-1';
const region = defaultRegion();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? '';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? '';
const ec2client = new EC2({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  region,
});

const getAvailabilityZones = async () => {
  return await ec2client.describeAvailabilityZones({
    Filters: [
      {
        Name: 'region-name',
        Values: [region],
      },
    ],
  });
};

const getInstanceTypeOffering = async (availabilityZones: string[]) => {
  return await ec2client.describeInstanceTypeOfferings({
    LocationType: 'availability-zone',
    Filters: [
      {
        Name: 'location',
        Values: availabilityZones,
      },
      {
        Name: 'instance-type',
        Values: ['t2.micro', 't3.micro'],
      },
    ],
  });
};

const roleName = `${prefix}-codedeploy-${region}`;
const ec2RoleName = `${prefix}-codedeploy-ec2-${region}`;

const codedeployRolePolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Sid: '',
      Effect: 'Allow',
      Principal: {
        Service: 'codedeploy.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
});
const codedeployPolicyArn = 'arn:aws:iam::aws:policy/AWSCodeDeployFullAccess';
const deployEC2PolicyArn = 'arn:aws:iam::aws:policy/AmazonEC2FullAccess';

const ec2RolePolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Sid: '',
      Effect: 'Allow',
      Principal: {
        Service: 'ec2.amazonaws.com',
      },
      Action: 'sts:AssumeRole',
    },
  ],
});
const ssmPolicyArn = 'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore';
const instanceTag = `${prefix}-codedeploy-vm`;

const ec2FilterTags = JSON.stringify([
  {
    Type: 'KEY_AND_VALUE',
    Key: 'name',
    Value: `${instanceTag}`,
  },
]);

const sgGroupName = `${prefix}sgcodedeploy`;

let availabilityZone: string;
let instanceType: string;

const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_codedeploy', 'aws_iam', 'aws_ec2'];

jest.setTimeout(560000);
beforeAll(async () => {
  const availabilityZones =
    (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName ?? '') ?? [];
  availabilityZone = availabilityZones.pop() ?? '';
  const instanceTypesByAz1 = await getInstanceTypeOffering([availabilityZone]);
  instanceType = instanceTypesByAz1.InstanceTypeOfferings?.pop()?.InstanceType ?? '';

  await execComposeUp();
});
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('AwsCodedeploy Integration Testing', () => {
  it('creates a new test db with the same name', done => {
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
    SELECT * FROM iasql_begin();
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${region}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the codedeploy module and dependencies', install(modules));

  it(
    'adds a new codedeploy role',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${roleName}', '${codedeployRolePolicy}', array['${codedeployPolicyArn}', '${deployEC2PolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new ec2 role',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${ec2RoleName}', '${ec2RolePolicy}', array['${deployEC2PolicyArn}', '${ssmPolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the role creation', commit());

  it(
    'adds a new security group',
    query(
      `  
    SELECT * FROM iasql_begin();
  
    INSERT INTO security_group (description, group_name)
    VALUES ('CodedeploySecurity Group', '${sgGroupName}');
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
    SELECT * FROM iasql_begin();
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT false, 'tcp', 22, 22, '0.0.0.0/0', '${prefix}codedeploy_rule_ssh', id
    FROM security_group
    WHERE group_name = '${sgGroupName}';
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT false, 'tcp', 80, 80, '0.0.0.0/0', '${prefix}codedeploy_rule_http', id
    FROM security_group
    WHERE group_name = '${sgGroupName}';
    INSERT INTO security_group_rule (is_egress, ip_protocol, from_port, to_port, cidr_ipv4, description, security_group_id)
    SELECT true, 'tcp', 1, 65335, '0.0.0.0/0', '${prefix}codedeploy_rule_egress', id
    FROM security_group
    WHERE group_name = '${sgGroupName}';

  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the security group and rules creation', commit());

  // create sample ec2 instance
  it('adds an ec2 instance', done => {
    query(
      `
      SELECT * FROM iasql_begin();
      BEGIN;
        INSERT INTO instance (ami, instance_type, tags, subnet_id, role_name, user_data)
          SELECT '${ubuntuAmiId}', '${instanceType}', '{"name":"${instanceTag}"}', id, '${ec2RoleName}', (SELECT generate_codedeploy_agent_install_script('${region}', 'ubuntu'))
          FROM subnet
          WHERE availability_zone = '${availabilityZone}'
          LIMIT 1;
        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${instanceTag}'),
          (SELECT id FROM security_group WHERE group_name='${sgGroupName}');
      COMMIT;
      `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      if (!!e) return done(e);
      done();
    });
  });

  it('applies the created instance', commit());

  it(
    'adds a new codedeploy_application',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationName}', 'Server');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'adds a new codedeploy_application',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationName}', 'Server');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply codedeploy_application creation', commit());

  it(
    'check codedeploy_application is available',
    query(
      `
  SELECT * FROM codedeploy_application WHERE name='${applicationName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update application ID',
    query(
      `
  SELECT * FROM iasql_begin();
  UPDATE codedeploy_application SET application_id='fake' WHERE name='${applicationName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the application ID update', commit());

  it(
    'checks that application ID has not been been modified',
    query(
      `
  SELECT * FROM codedeploy_application WHERE application_id='fake' AND name='${applicationName}';
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'tries to update the codedeploy_application compute_platform',
    query(
      `
  SELECT * FROM iasql_begin();
  UPDATE codedeploy_application SET compute_platform='Lambda' WHERE name='${applicationName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the codedeploy_application compute_platform update', commit());

  it(
    'checks that codedeploy_application compute_platform has been modified',
    query(
      `
  SELECT * FROM codedeploy_application WHERE compute_platform='Lambda' AND name='${applicationName}';
`,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('uninstalls the codedeploy module', uninstall(modules));

  it('installs the codedeploy module', install(modules));

  it(
    'delete application',
    query(
      `
    SELECT * FROM iasql_begin();
    DELETE FROM codedeploy_application
    WHERE name = '${applicationName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the application deletion', commit());

  // deployment group testing
  it(
    'adds a new codedeploy_application for deployment',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationNameForDeployment}', 'Server');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a new deployment_group',
    query(
      `
    SELECT * FROM iasql_begin();
    INSERT INTO codedeploy_deployment_group (application_id, name, role_name)
    VALUES ((SELECT id FROM codedeploy_application WHERE name = '${applicationNameForDeployment}'), '${deploymentGroupName}', '${roleName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply codedeploy_deployment_group creation', commit());

  it(
    'check codedeploy_deployment_group is available',
    query(
      `
  SELECT * FROM codedeploy_deployment_group WHERE name='${deploymentGroupName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it(
    'tries to update the codedeploy_deployment_group tags',
    query(
      `
  SELECT * FROM iasql_begin();
  UPDATE codedeploy_deployment_group SET ec2_tag_filters='${ec2FilterTags}' WHERE name='${deploymentGroupName}'
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the codedeploy_deployment_group update', commit());

  it(
    'checks that codedeploy_deployment_group has been modified',
    query(
      `
  SELECT * FROM codedeploy_deployment_group WHERE role_name='${roleName}' AND name='${deploymentGroupName}'
  ;
`,
      (res: any[]) => {
        expect(res.length).toBe(1),
          expect(JSON.stringify(res[0].ec2_tag_filters)).toEqual(`${ec2FilterTags}`);
      },
    ),
  );
});

describe('Move deployments to another region', () => {
  it('should fail moving just the deployment group', done =>
    void query(
      `
      SELECT * FROM iasql_begin();
      UPDATE codedeploy_deployment_group
      SET region = '${nonDefaultRegion}'
      WHERE name = '${deploymentGroupName}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      try {
        expect(e?.message).toContain('violates foreign key constraint');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it('should fail moving just the application', done =>
    void query(
      `
      SELECT * FROM iasql_begin();
      UPDATE codedeploy_application
      SET region = '${nonDefaultRegion}'
      WHERE name = '${applicationNameForDeployment}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    )((e?: any) => {
      console.log({ e });
      try {
        expect(e?.message).toContain('violates foreign key constraint');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it(
    'moves a deployment to another region',
    query(
      `
      WITH
        updated_deployment_group AS (
          UPDATE codedeploy_deployment_group
          SET region = '${nonDefaultRegion}'
          WHERE name = '${deploymentGroupName}'
        ),
        updated_deployments AS (
          UPDATE codedeploy_deployment
          SET region = '${nonDefaultRegion}'
          FROM codedeploy_deployment_group, codedeploy_application
          WHERE codedeploy_deployment.application_id = codedeploy_application.id AND
            codedeploy_deployment_group.id = codedeploy_deployment.deployment_group_id AND
            codedeploy_deployment_group.name = '${deploymentGroupName}' AND
            codedeploy_application.name = '${applicationNameForDeployment}'
        )
        UPDATE codedeploy_application
        SET region = '${nonDefaultRegion}'
        WHERE name = '${applicationNameForDeployment}'
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply region move', commit());
});

// cleanup
describe('deployment cleanup', () => {
  it(
    'delete deployment group',
    query(
      `
      SELECT * FROM iasql_begin();
      DELETE FROM codedeploy_deployment_group
      WHERE name = '${deploymentGroupName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'delete application',
    query(
      `
      SELECT * FROM iasql_begin();
      DELETE FROM codedeploy_application
      WHERE name = '${applicationNameForDeployment}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply codedeploy_application deletion', commit());

  it(
    'check no codedeploy_deployment_groups remain',
    query(
      `
SELECT * FROM codedeploy_deployment_group WHERE application_id = (SELECT id FROM codedeploy_application WHERE name = '${applicationNameForDeployment}');
`,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  it(
    'check no codedeploy_deployments remain',
    query(
      `
    SELECT * FROM codedeploy_deployment WHERE application_id = (SELECT id FROM codedeploy_application WHERE name = '${applicationNameForDeployment}');
    `,
      (res: any) => expect(res.length).toBe(0),
    ),
  );

  describe('ec2 cleanup', () => {
    it(
      'deletes all ec2 instances',
      query(
        `
      SELECT * FROM iasql_begin();
      BEGIN;
        DELETE FROM general_purpose_volume
        USING instance
        WHERE instance.id = general_purpose_volume.attached_instance_id AND 
          (instance.tags ->> 'name' = '${instanceTag}');
  
        DELETE FROM instance
        WHERE tags ->> 'name' = '${instanceTag}';
      COMMIT;
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the instance deletion', commit());
  });

  describe('delete roles', () => {
    it(
      'deletes role',
      query(
        `
        SELECT * FROM iasql_begin();
        DELETE FROM iam_role WHERE role_name = '${roleName}' OR role_name='${ec2RoleName}';
      `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the role deletion', commit());
  });

  describe('delete security groups and rules', () => {
    it(
      'deletes security group rules',
      query(
        `
        SELECT * FROM iasql_begin();
        DELETE FROM security_group_rule WHERE description='${prefix}codedeploy_rule_ssh' or description='${prefix}codedeploy_rule_http' or description='${prefix}codedeploy_rule_egress';
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
        SELECT * FROM iasql_begin();
        DELETE FROM security_group WHERE group_name = '${sgGroupName}';
      `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the security group deletion', commit());
  });

  it('apply delete', commit());

  // cleanup
  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('AwsCodedeploy install/uninstall', () => {
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
    SELECT * FROM iasql_begin();
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the codedeploy module', install(modules));

  it('uninstalls the codedeploy module', uninstall(modules));

  it('installs all modules', done => void iasql.install([], dbAlias, 'postgres', true).then(...finish(done)));

  it('uninstalls the codedeploy module', uninstall(['aws_codedeploy', 'aws_codepipeline']));

  it('installs the codedeploy module', install(['aws_codedeploy']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
