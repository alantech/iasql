import { EC2 } from '@aws-sdk/client-ec2';

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
const dbAlias = 'codedeploytest';
const applicationName = `${prefix}${dbAlias}application`;
const lambdaApplicationName = `${prefix}${dbAlias}lambdaApplication`;
const applicationNameForDeployment = `${prefix}${dbAlias}applicationForDeployment`;
const deploymentGroupName = `${prefix}${dbAlias}deployment_group`;
const lambdaDeploymentGroupName = `${prefix}${dbAlias}lambdaDeployment_group`;
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
const lambdaRoleName = `${prefix}-lambda-codedeploy-${region}`;

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
const deployLambdaPolicyArn = 'arn:aws:iam::aws:policy/service-role/AWSCodeDeployRoleForLambda';

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

const revisionLocation = JSON.stringify({
  revisionType: 'GitHub',
  gitHubLocation: {
    repository: 'iasql/iasql-codedeploy-example',
    commitId: 'cf6aa63cbd2502a5d1064363c2af5c56cc2107cc',
  },
});

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

const lambdaDeploymentStyle = JSON.stringify({
  deploymentOption: 'WITH_TRAFFIC_CONTROL',
  deploymentType: 'BLUE_GREEN',
});

let availabilityZone: string;
let instanceType: string;

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const installAll = runInstallAll.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const modules = ['aws_codedeploy', 'aws_iam', 'aws_ec2', 'aws_codebuild'];

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

  itDocs('installs the codedeploy module and dependencies', install(modules));

  it('starts a transaction', begin());

  itDocs(
    'adds a new codedeploy role',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${roleName}', '${codedeployRolePolicy}', array['${codedeployPolicyArn}', '${deployEC2PolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'adds a new codedeploy role for lambda',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${lambdaRoleName}', '${codedeployRolePolicy}', array['${codedeployPolicyArn}', '${deployLambdaPolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'adds a new ec2 role',
    query(
      `
    INSERT INTO iam_role (role_name, assume_role_policy_document, attached_policies_arns)
    VALUES ('${ec2RoleName}', '${ec2RolePolicy}', array['${deployEC2PolicyArn}', '${ssmPolicyArn}']);
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the role creation', commit());

  it('starts a transaction', begin());

  itDocs(
    'adds a new security group',
    query(
      `
    INSERT INTO security_group (description, group_name)
    VALUES ('CodedeploySecurity Group', '${sgGroupName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'adds security group rules',
    query(
      `
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
  it('starts a transaction', begin());

  itDocs('adds an ec2 instance', (done: (arg0: any) => any) => {
    query(
      `
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
      done(undefined);
    });
  });

  it('applies the created instance', commit());

  it('starts a transaction', begin());

  // creates codedeploy application for EC2
  it(
    'adds a new codedeploy_application',
    query(
      `
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationName}', 'Server');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it('starts a transaction', begin());

  itDocs(
    'adds a new codedeploy_application',
    query(
      `
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationName}', 'Server');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply codedeploy_application creation', commit());

  itDocs(
    'check codedeploy_application is available',
    query(
      `
  SELECT * FROM codedeploy_application WHERE name='${applicationName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update application ID',
    query(
      `
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

  it('starts a transaction', begin());

  it(
    'tries to update the codedeploy_application compute_platform',
    query(
      `
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

  it('starts a transaction', begin());

  itDocs(
    'delete application',
    query(
      `
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
  it('starts a transaction', begin());

  itDocs(
    'adds a new codedeploy_application for deployment',
    query(
      `
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${applicationNameForDeployment}', 'Server');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'adds a new deployment_group',
    query(
      `
    INSERT INTO codedeploy_deployment_group (application_id, name, role_name)
    VALUES ((SELECT id FROM codedeploy_application WHERE name = '${applicationNameForDeployment}'), '${deploymentGroupName}', '${roleName}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('apply codedeploy_deployment_group creation', commit());

  itDocs(
    'check codedeploy_deployment_group is available',
    query(
      `
  SELECT * FROM codedeploy_deployment_group WHERE name='${deploymentGroupName}';
  `,
      (res: any) => expect(res.length).toBe(1),
    ),
  );

  it('starts a transaction', begin());

  it(
    'tries to update the codedeploy_deployment_group tags',
    query(
      `
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

// creates codedeploy application for Lambda
it('starts a transaction', begin());

itDocs(
  'adds a new codedeploy_application for lambda',
  query(
    `
    INSERT INTO codedeploy_application (name, compute_platform)
    VALUES ('${lambdaApplicationName}', 'Lambda');
  `,
    undefined,
    true,
    () => ({ username, password }),
  ),
);

itDocs(
  'adds a new deployment_group for Lambda',
  query(
    `
    INSERT INTO codedeploy_deployment_group (application_id, name, role_name, deployment_style, deployment_config_name)
    VALUES ((SELECT id FROM codedeploy_application WHERE name = '${lambdaApplicationName}'), '${lambdaDeploymentGroupName}', '${lambdaRoleName}', '${lambdaDeploymentStyle}', 'CodeDeployDefault.LambdaAllAtOnce');
  `,
    undefined,
    true,
    () => ({ username, password }),
  ),
);
it('applies lambda deployment app and group creation', commit());

// triggers a deployment
itDocs(
  'start and wait for deployment',
  query(
    `
    SELECT * FROM start_deployment('${applicationNameForDeployment}', '${deploymentGroupName}', '${revisionLocation}', '${region}');
`,
    (res: any[]) => {
      expect(res.length).toBe(1);
      expect(res[0].status).toBe('OK');
    },
  ),
);

itDocs(
  'check deployment exists in list',
  query(
    `
  SELECT * FROM codedeploy_deployment
  WHERE application_id = (SELECT id FROM codedeploy_application WHERE codedeploy_application.name='${applicationNameForDeployment}') and region = '${region}';
`,
    (res: any[]) => expect(res.length).toBe(1),
  ),
);

it('starts a transaction', begin());

it(
  'delete deployments',
  query(
    `
    DELETE FROM codedeploy_deployment
    WHERE application_id IN (SELECT id FROM codedeploy_application WHERE codedeploy_application.name='${applicationNameForDeployment}' AND region='${region}');
  `,
    undefined,
    true,
    () => ({ username, password }),
  ),
);

it('applies deployment deletion', commit());

it(
  'check deployment could not be deleted',
  query(
    `
  SELECT * FROM codedeploy_deployment
  WHERE application_id = (SELECT id FROM codedeploy_application WHERE codedeploy_application.name='${applicationNameForDeployment}' and region = '${region}');
`,
    (res: any[]) => expect(res.length).toBe(1),
  ),
);

describe('Move deployments to another region', () => {
  it('should fail moving just the deployment group', done =>
    void query(
      `
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

  it('starts a transaction', begin());

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
describe('application cleanup', () => {
  it('starts a transaction', begin());

  it(
    'delete deployment group',
    query(
      `
      DELETE FROM codedeploy_deployment_group
      WHERE name = '${deploymentGroupName}' OR name='${lambdaDeploymentGroupName}';
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
      DELETE FROM codedeploy_application
      WHERE name = '${applicationNameForDeployment}' OR name='${lambdaApplicationName}';
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
    it('starts a transaction', begin());

    it(
      'deletes all ec2 instances',
      query(
        `  
        DELETE FROM instance
        WHERE tags ->> 'name' = '${instanceTag}';
    `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the instance deletion', commit());
  });

  describe('delete roles', () => {
    it('starts a transaction', begin());

    it(
      'deletes role',
      query(
        `
        DELETE FROM iam_role WHERE role_name IN ('${roleName}', '${ec2RoleName}', '${lambdaRoleName}');
      `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the role deletion', commit());
  });

  describe('delete security groups and rules', () => {
    it('starts a transaction', begin());

    it(
      'deletes security group rules',
      query(
        `
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
        DELETE FROM security_group WHERE group_name = '${sgGroupName}';
      `,
        undefined,
        true,
        () => ({ username, password }),
      ),
    );

    it('applies the security group deletion', commit());
  });

  it('starts a transaction', begin());

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

  it('installs the codedeploy module', install(modules));

  it('uninstalls the codedeploy module', uninstall(modules));

  it('installs all modules', installAll());

  it('uninstalls the codedeploy module', uninstall(['aws_codedeploy', 'aws_codepipeline']));

  it('installs the codedeploy module', install(['aws_codedeploy']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
