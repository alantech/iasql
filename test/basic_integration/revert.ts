import {
  IpAddressType,
  LoadBalancerSchemeEnum,
  LoadBalancerTypeEnum,
} from '../../src/modules/aws_elb/entity';
import * as iasql from '../../src/services/iasql';
import {
  runQuery,
  finish,
  execComposeUp,
  execComposeDown,
  runInstall,
  runBegin,
  defaultRegion,
  runCommit,
  getPrefix,
  runUninstall,
} from '../helpers';

const prefix = getPrefix();
const dbAlias = `${prefix}reverttest`;
const amznAmiId = 'resolve:ssm:/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2';
const sgName = `${prefix}-rv-sg`;
const lbName = `${prefix}revertlb`;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbTypeApp = LoadBalancerTypeEnum.APPLICATION;
const lbIPAddressType = IpAddressType.IPV4;
const lbInitDefaultAttributes = [
  { Key: 'access_logs.s3.enabled', Value: 'false' },
  { Key: 'access_logs.s3.bucket', Value: '' },
  { Key: 'access_logs.s3.prefix', Value: '' },
  { Key: 'idle_timeout.timeout_seconds', Value: '60' },
  { Key: 'deletion_protection.enabled', Value: 'false' },
  { Key: 'routing.http2.enabled', Value: 'true' },
  { Key: 'routing.http.drop_invalid_header_fields.enabled', Value: 'false' },
  { Key: 'routing.http.xff_client_port.enabled', Value: 'false' },
  { Key: 'routing.http.preserve_host_header.enabled', Value: 'false' },
  { Key: 'routing.http.xff_header_processing.mode', Value: 'append' },
  { Key: 'load_balancing.cross_zone.enabled', Value: 'true' },
  { Key: 'routing.http.desync_mitigation_mode', Value: 'defensive' },
  { Key: 'waf.fail_open.enabled', Value: 'false' },
  { Key: 'routing.http.x_amzn_tls_version_and_cipher_suite.enabled', Value: 'false' },
];

const begin = runBegin.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const uid = '12345';
const email = 'test@example.com';
const region = defaultRegion();
const modules = ['aws_ec2', 'aws_elb'];

jest.setTimeout(420000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('basic revert functionality on failed commit', () => {
  it('creates a new test db', done => {
    (async () => {
      try {
        const { user, password: pgPassword } = await iasql.connect(dbAlias, uid, email);
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

  it('installs the module', install(modules));

  it('starts a transaction', begin());

  it(
    'insert a log group',
    query(
      `
        BEGIN;
          INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type, attributes, availability_zones)
          VALUES ('${lbName}', '${lbScheme}', null, '${lbTypeApp}', '${lbIPAddressType}', '${JSON.stringify(
        lbInitDefaultAttributes,
      )}', (SELECT array_agg(az.name) FROM (SELECT name from availability_zone WHERE region = '${region}' GROUP BY name ORDER BY name ASC LIMIT 2) as az));

          INSERT INTO load_balancer_security_groups(load_balancer_id, security_group_id)
            SELECT (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}' LIMIT 1),
            (SELECT id FROM security_group WHERE group_name = 'default' AND region = '${region}' LIMIT 1);

          INSERT INTO security_group (description, group_name, region)
          VALUES ('${sgName} security group', '${sgName}', '${region}');

          INSERT INTO instance (ami, instance_type, tags, subnet_id)
            SELECT '${amznAmiId}', 'fake-instance-type', '{"name":"${dbAlias}"}', id
            FROM subnet
            WHERE availability_zone = (SELECT name FROM availability_zone WHERE region = '${region}' ORDER BY 1 DESC LIMIT 1)
            LIMIT 1;

          INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
            (SELECT id FROM instance WHERE tags ->> 'name' = '${dbAlias}'),
            (SELECT id FROM security_group WHERE group_name='${sgName}' AND region = '${region}');
        COMMIT;
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'checks the security group',
    query(
      `
        select * from security_group where group_name = '${sgName}';
      `,
      (res: any) => {
        expect(res.length).toBe(1);
      },
    ),
  );

  it(
    'checks the instance',
    query(
      `
        select * from instance where tags ->> 'name' = '${dbAlias}';
      `,
      (res: any) => {
        expect(res.length).toBe(1);
      },
    ),
  );

  it(
    'checks load_balancer insertion',
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

  it('commit should fail and revert', done =>
    void query(`
      SELECT * FROM iasql_commit();
    `)((e?: any) => {
      try {
        expect(e?.message).toContain('Instance cloud create error');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  it(
    'checks the security group',
    query(
      `
        select * from security_group where group_name = '${sgName}';
      `,
      (res: any) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it(
    'checks the instance',
    query(
      `
        select * from instance where tags ->> 'name' = '${dbAlias}';
      `,
      (res: any) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it(
    'checks load_balancer',
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
    'check load_balancer_security_groups',
    query(
      `
        SELECT *
        FROM load_balancer_security_groups
        WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('confirm you can start a transaction after the revert', begin());

  it('close transaction', commit());

  it('uninstalls the modules', uninstall(modules));

  it('installs the modules', install(modules));

  it(
    'checks the security group',
    query(
      `
        select * from security_group where group_name = '${sgName}';
      `,
      (res: any) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it(
    'checks the instance',
    query(
      `
        select * from instance where tags ->> 'name' = '${dbAlias}';
      `,
      (res: any) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it(
    'checks load_balancer',
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
    'check load_balancer_security_groups',
    query(
      `
        SELECT *
        FROM load_balancer_security_groups
        WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, uid).then(...finish(done)));
});
