import { LoadBalancerStateEnum } from '@aws-sdk/client-elastic-load-balancing-v2';

import config from '../../src/config';
import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getKeyCertPair,
  getPrefix,
  runCommit,
  runInstall,
  runQuery,
  runRollback,
  runUninstall,
} from '../helpers';

const {
  IpAddressType,
  LoadBalancerSchemeEnum,
  LoadBalancerTypeEnum,
  ProtocolEnum,
  TargetTypeEnum,
} = require(`../../src/modules/${config.modules.latestVersion}/aws_elb/entity`);

const prefix = getPrefix();
const dbAlias = 'elbtest';

const domainName = `${prefix}${dbAlias}.com`;
const [key, cert] = getKeyCertPair(domainName);

const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const region = defaultRegion();
const modules = ['aws_security_group', 'aws_elb', 'aws_vpc', 'aws_acm', 'aws_route53'];

const loadBalancerAttribute = {
  Key: 'idle_timeout.timeout_seconds',
  Value: '120',
};

const loadBalancerAttributes = JSON.stringify([loadBalancerAttribute]);
// Test constants
const tgName = `${prefix}${dbAlias}tg`;
const lbName = `${prefix}${dbAlias}lb`;
const tgType = TargetTypeEnum.IP;
const port = 5678;
const portHTTPS = 443;
const protocol = ProtocolEnum.HTTP;
const protocolHTTPS = ProtocolEnum.HTTPS;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbType = LoadBalancerTypeEnum.APPLICATION;
const lbIPAddressType = IpAddressType.IPV4;
const sg1 = `${prefix}${dbAlias}lbsg1`;
const sg2 = `${prefix}${dbAlias}lbsg2`;

jest.setTimeout(420000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('ELB Integration Testing', () => {
  it('creates a new test db elb', done => {
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
        UPDATE aws_regions
        SET is_default = TRUE
        WHERE region = '${region}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the elb module', install(modules));

  // Target group
  it(
    'adds a new targetGroup',
    query(
      `
        SELECT * FROM iasql_begin();
        INSERT INTO target_group (target_group_name, target_type, protocol, port, vpc, health_check_path)
        VALUES ('${tgName}', '${tgType}', '${protocol}', ${port}, null, '/health');
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'check target_group insertion',
    query(
      `
          SELECT *
          FROM target_group
          WHERE target_group_name = '${tgName}';
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'adds a new targetGroup',
    query(
      `
        SELECT * FROM iasql_begin();
        INSERT INTO target_group (target_group_name, target_type, protocol, port, vpc, health_check_path)
        VALUES ('${tgName}', '${tgType}', '${protocol}', ${port}, null, '/health');
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check target_group insertion',
    query(
      `
          SELECT *
          FROM target_group
          WHERE target_group_name = '${tgName}';
      `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the change', commit());

  it(
    'tries to update a target group field',
    query(
      `
        SELECT * FROM iasql_begin();
        UPDATE target_group
        SET health_check_path = '/fake-health'
        WHERE target_group_name = '${tgName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'tries to update a target group field (replace)',
    query(
      `
        SELECT * FROM iasql_begin();
        UPDATE target_group
        SET port = 5677
        WHERE target_group_name = '${tgName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  // Load balancer
  it(
    'adds a new load balancer',
    query(
      `
        SELECT * FROM iasql_begin();
        INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
        VALUES ('${lbName}', '${lbScheme}', null, '${lbType}', '${lbIPAddressType}');
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('undo changes', rollback());

  it(
    'check load_balancer insertion',
    query(
      `SELECT *
       FROM load_balancer
       WHERE load_balancer_name = '${lbName}';
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'adds new security groups',
    query(
      `
              SELECT * FROM iasql_begin();
              INSERT INTO security_group (description, group_name)
              VALUES ('Security Group Test 1', '${sg1}');
              INSERT INTO security_group (description, group_name)
              VALUES ('Security Group Test 2', '${sg2}');
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'adds a new load balancer',
    query(
      `
    SELECT * FROM iasql_begin();
    BEGIN;
      INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
      VALUES ('${lbName}', '${lbScheme}', null, '${lbType}', '${lbIPAddressType}');

      INSERT INTO load_balancer_security_groups(load_balancer_id, security_group_id)
      SELECT (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}'),
             (SELECT id FROM security_group WHERE group_name = '${sg1}');
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check load_balancer insertion',
    query(
      `
          SELECT *
          FROM load_balancer
          WHERE load_balancer_name = '${lbName}';
      `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'check load_balancer_security_groups insertion',
    query(
      `
          SELECT *
          FROM load_balancer_security_groups
          WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
      `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the change', commit());

  it(
    'tries to update a load balancer attribute (update)',
    query(
      `SELECT * FROM iasql_begin();
UPDATE load_balancer SET attributes='${loadBalancerAttributes}' WHERE load_balancer_name='${lbName}'`,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies the change', commit());
  it(
    'check load balancer attributes modification',
    query(
      `
          SELECT *
          FROM load_balancer
          WHERE load_balancer_name = '${lbName}';
      `,
      (res: any[]) => {
        expect(res.length).toBe(1);
        expect(res[0].attributes).toEqual(
          expect.arrayContaining([expect.objectContaining(loadBalancerAttribute)]),
        );
      },
    ),
  );

  it(
    'tries to update a load balancer field',
    query(
      `
        SELECT * FROM iasql_begin();
        UPDATE load_balancer
        SET state = '${LoadBalancerStateEnum.FAILED}'
        WHERE load_balancer_name = '${lbName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change and restore it', commit());

  it(
    'tries to update a load balancer security group (replace)',
    query(
      `
        SELECT * FROM iasql_begin();
        UPDATE load_balancer_security_groups
        SET security_group_id = (SELECT id FROM security_group WHERE group_name = '${sg2}')
        WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'tries to update a load balancer scheme (replace)',
    query(
      `
        SELECT * FROM iasql_begin();
        UPDATE load_balancer
        SET scheme = '${LoadBalancerSchemeEnum.INTERNAL}'
        WHERE load_balancer_name = '${lbName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'adds a new listener',
    query(
      `
        SELECT * FROM iasql_begin();
        INSERT INTO listener (load_balancer_id, port, protocol, target_group_id)
        VALUES ((SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}'),
                ${port},
                '${protocol}',
                (SELECT id FROM target_group WHERE target_group_name = '${tgName}'));
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check listener insertion',
    query(
      `
          SELECT *
          FROM listener
          WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
      `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('applies the change', commit());

  it(
    'tries to update a listener field',
    query(
      `
        SELECT * FROM iasql_begin();
        UPDATE listener
        SET port = ${port + 1}
        WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the change', commit());

  it(
    'adds a new certificate to import',
    query(`
      SELECT * FROM certificate_import('${cert}', '${key}', '${region}', '');
  `),
  );

  it(
    'check new certificate added',
    query(
      `
          SELECT *
          FROM certificate
          WHERE domain_name = '${domainName}';
      `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'adds a new HTTPS listener',
    query(
      `
        SELECT * FROM iasql_begin();
        INSERT INTO listener (load_balancer_id, port, protocol, target_group_id, certificate_id)
        VALUES ((SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}'),
                ${portHTTPS},
                '${protocolHTTPS}',
                (SELECT id FROM target_group WHERE target_group_name = '${tgName}'),
                (SELECT id FROM certificate WHERE domain_name = '${domainName}'));
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check https listener insertion',
    query(
      `
          SELECT *
          FROM listener
          WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
      `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('applies the https listener change', commit());

  it(
    'check https listener insertion',
    query(
      `
          SELECT *
          FROM listener
          WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
      `,
      (res: any[]) => expect(res.length).toBe(2),
    ),
  );

  it('uninstalls the elb module', uninstall(['aws_acm', 'aws_route53', 'aws_elb']));

  it('installs the elb module', install(['aws_elb']));

  it(
    'deletes the listener',
    query(
      `
        SELECT * FROM iasql_begin();
        DELETE
        FROM listener
        WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check listener delete',
    query(
      `
          SELECT *
          FROM listener
          WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the change', commit());

  it(
    'deletes the load balancer',
    query(
      `
        SELECT * FROM iasql_begin();
        DELETE
        FROM load_balancer
        WHERE load_balancer_name = '${lbName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check load_balancer delete',
    query(
      `
          SELECT *
          FROM load_balancer
          WHERE load_balancer_name = '${lbName}';
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'deletes the security groups',
    query(
      `
        DELETE
        FROM security_group
        WHERE group_name IN ('${sg1}', '${sg2}');
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check load_balancer delete',
    query(
      `
          SELECT *
          FROM security_group
          WHERE group_name IN ('${sg1}', '${sg2}');
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the change', commit());

  it(
    'deletes the target group',
    query(
      `
        SELECT * FROM iasql_begin();
        DELETE
        FROM target_group
        WHERE target_group_name = '${tgName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check target_group deletion',
    query(
      `
          SELECT *
          FROM target_group
          WHERE target_group_name = '${tgName}';
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the change (last time)', commit());

  it(
    'deletes the certificate',
    query(
      `
        SELECT * FROM iasql_begin();
        DELETE
        FROM certificate
        WHERE domain_name = '${domainName}';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'check certificate deletion',
    query(
      `
          SELECT *
          FROM certificate
          WHERE domain_name = '${domainName}';
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('applies the cert delete change', commit());

  it(
    'creates a target group in non-default region',
    query(
      `
        SELECT * FROM iasql_begin();
        INSERT INTO target_group (target_group_name, target_type, protocol, port, vpc, health_check_path, region)
        VALUES ('${tgName}', '${tgType}', '${protocol}', ${port}, null, '/health', 'us-east-1');
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies creation of the target group in non-default region', commit());

  it(
    'verifies the target group is created',
    query(
      `
      SELECT target_group_arn
      FROM target_group
      WHERE target_group_name = '${tgName}';
  `,
      (res: any) => {
        expect(res.length).toBe(1);
        expect(res[0].target_group_arn).not.toEqual('');
      },
    ),
  );

  it(
    'creates a security group in non-default region',
    query(
      `
      SELECT * FROM iasql_begin();
      INSERT INTO security_group (description, group_name, region)
      VALUES ('Security Group Multi-region Test 1', '${sg1}', 'us-east-1');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'creates a load balancer in non-default region',
    query(
      `
    BEGIN;
      INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type, region)
      VALUES ('${lbName}', '${lbScheme}', null, '${lbType}', '${lbIPAddressType}', 'us-east-1');

      INSERT INTO load_balancer_security_groups(load_balancer_id, security_group_id)
      SELECT (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}'),
             (SELECT id FROM security_group WHERE group_name = '${sg1}');
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies the creation of load balancer and security group in non-default region', commit());

  it(
    'verifies that load balancer in non-default region is created',
    query(
      `
      SELECT load_balancer_arn
      FROM load_balancer
      WHERE load_balancer_name = '${lbName}';
  `,
      (res: any) => {
        expect(res.length).toBe(1);
        expect(res[0].load_balancer_arn).not.toBeNull();
      },
    ),
  );

  it(
    'adds a listener to the load balancer in non-default region',
    query(
      `
      SELECT * FROM iasql_begin();
      INSERT INTO listener (load_balancer_id, port, protocol, target_group_id)
      VALUES ((SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}'),
              ${port},
              '${protocol}',
              (SELECT id FROM target_group WHERE target_group_name = '${tgName}'));
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies creation of the listener in non-default region', commit());

  it(
    'verifies the listener in non-default region is created',
    query(
      `
      SELECT listener_arn
      FROM listener;
  `,
      (res: any) => {
        expect(res.length).toBe(1);
        expect(res[0].listener_arn).not.toBeNull();
      },
    ),
  );

  it(
    'deletes multi-region resources',
    query(
      `
    SELECT * FROM iasql_begin();
    BEGIN;
        DELETE
        FROM listener
        WHERE target_group_id = (SELECT id FROM target_group WHERE target_group_name = '${tgName}');

        DELETE
        FROM target_group
        WHERE target_group_name = '${tgName}';

        DELETE
        FROM security_group
        WHERE group_name = '${sg1}';

        DELETE
        FROM load_balancer
        WHERE load_balancer_name = '${lbName}';
    COMMIT;
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('applies deletion of multi-region resources', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});

describe('ELB install/uninstall', () => {
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
        UPDATE aws_regions
        SET is_default = TRUE
        WHERE region = 'us-east-1';
    `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the ELB module', install(modules));

  it('uninstalls the ELB module', uninstall(modules));

  it('installs all modules', done =>
    void iasql.install([], dbAlias, config.db.user, true).then(...finish(done)));

  it(
    'uninstalls the ELB module and its dependent ones',
    uninstall([
      'aws_ecs_fargate',
      'aws_ecs_simplified',
      'aws_ec2',
      'aws_ec2_metadata',
      'aws_route53',
      'aws_vpc',
      'aws_acm',
      'aws_security_group',
      'aws_memory_db',
      'aws_rds',
      'aws_codedeploy',
      'aws_codepipeline',
      'aws_elb',
      'aws_lambda',
    ]),
  );

  it('installs the ELB module', install(['aws_elb']));

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
