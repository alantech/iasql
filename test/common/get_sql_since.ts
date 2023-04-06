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
  itDocs,
} from '../helpers';

const dbAlias = 'getsqlsince';
const dbAlias2 = 'getsqlsince2';
const region = defaultRegion();

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const query2 = runQuery.bind(null, dbAlias2);
const install = runInstall.bind(null, dbAlias);
const install2 = runInstall.bind(null, dbAlias2);

const lbName = `${dbAlias}lb`;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbType = LoadBalancerTypeEnum.APPLICATION;
const lbIPAddressType = IpAddressType.IPV4;
const lbAttributes = [
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

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;
let username2: string, password2: string;
let timestamp: string;
let sql: string;

describe('iasql_get_sql_since functionality', () => {
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

  itDocs('installs the aws_account module', install(['aws_account']));

  itDocs(
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

  itDocs(
    'should work with no arguments retrieving all logs',
    query(
      `
        SELECT * FROM iasql_get_sql_since();
      `,
      (res: any) => {
        expect(res.length).toBeGreaterThan(0);
      },
    ),
  );

  itDocs(
    'should work with a valid text timestamp',
    query(
      `
        SELECT * FROM iasql_get_sql_since('2023-01-01T12:00:00');
      `,
      (res: any) => {
        expect(res.length).toBeGreaterThan(0);
      },
    ),
  );

  itDocs(
    'should work with a dynamic date',
    query(
      `
        SELECT * FROM iasql_get_sql_since(now() + interval '2 seconds');
      `,
      (res: any) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it('should fail with a string that cannot be casted to timestamp with timezone', done =>
    void query(`
      SELECT * FROM iasql_get_sql_since('abcd');
    `)((e?: any) => {
      try {
        expect(e?.message).toContain('invalid input syntax for type timestamp with time zone');
      } catch (err) {
        done(err);
        return {};
      }
      done();
      return {};
    }));

  itDocs('installs the aws_elb module', install(['aws_elb']));

  it(
    'saves the timestamp to be used later',
    query(
      `
        SELECT current_timestamp;
      `,
      (res: any) => {
        expect(res.length).toBe(1);
        timestamp = res
          ?.map((o: { current_timestamp: string }) => new Date(o.current_timestamp).toISOString())
          .pop();
      },
    ),
  );

  itDocs('begin a transaction', begin());

  itDocs(
    'adds a new load balancer',
    query(
      `
        BEGIN;
          INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type, attributes, availability_zones)
          VALUES ('${lbName}', '${lbScheme}', null, '${lbType}', '${lbIPAddressType}', '${JSON.stringify(
        lbAttributes,
      )}', (SELECT array_agg(az.name) FROM (SELECT name from availability_zone WHERE region = '${region}' GROUP BY name ORDER BY name ASC LIMIT 2) as az));

          INSERT INTO load_balancer_security_groups(load_balancer_id, security_group_id)
          SELECT (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}'),
                (SELECT id FROM security_group WHERE group_name = 'default' AND region = '${region}');
        COMMIT;
      `,
      undefined,
      true,
      () => ({ username, password }),
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

  itDocs(
    'checks sql sub-query tables load_balancer and security_group for load_balancer_security_group join table',
    query(
      `
        SELECT * FROM iasql_get_sql_since();
      `,
      (res: any) => {
        expect(
          res.find((o: { sql: string }) => o.sql.includes('load_balancer_security_group')).sql,
        ).toContain(`SELECT id FROM load_balancer`);
        expect(
          res.find((o: { sql: string }) => o.sql.includes('load_balancer_security_group')).sql,
        ).toContain(`SELECT id FROM security_group`);
      },
    ),
  );

  it(
    'Force latest inserts to have the same timestamp (this would be the case if on install we bring some load balancers from the cloud)',
    query(
      `
        WITH load_balancer_ts AS (
          SELECT ts
          FROM iasql_audit_log
          WHERE change_type = 'INSERT' AND table_name = 'load_balancer'
          ORDER BY ts DESC
          LIMIT 1
        )
        UPDATE iasql_audit_log
        SET ts = load_balancer_ts.ts
        FROM load_balancer_ts
        WHERE change_type = 'INSERT' AND table_name = 'load_balancer_security_groups'
      `,
      undefined,
      true,
    ),
  );

  itDocs(
    'checks timestamp update',
    query(
      `
        SELECT *
        FROM iasql_audit_log
        WHERE change_type = 'INSERT' AND table_name IN ('load_balancer_security_groups', 'load_balancer');
      `,
      (res: any) => {
        expect(res.length).toBe(2);
        expect(res[0].ts).toStrictEqual(res[1].ts);
      },
    ),
  );

  it(
    'checks correct order of sql statements',
    query(
      `
        SELECT * FROM iasql_get_sql_since();
      `,
      (res: any) => {
        expect(res[res.length - 1].sql).toContain(`INSERT INTO load_balancer_security_groups (`);
        expect(res[res.length - 2].sql).toContain(`INSERT INTO load_balancer (`);
      },
    ),
  );

  it('creates a new test db', done => {
    (async () => {
      try {
        const { user, password: pgPassword } = await iasql.connect(dbAlias2, 'not-needed', 'not-needed');
        username2 = user;
        password2 = pgPassword;
        if (!username2 || !password2) throw new Error('Did not fetch pg credentials');
        done();
      } catch (e) {
        done(e);
      }
    })();
  });

  it('installs the aws_account module', install2(['aws_account']));

  it(
    'inserts aws credentials',
    query2(
      `
        INSERT INTO aws_credentials (access_key_id, secret_access_key)
        VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
      `,
      undefined,
      false,
      () => ({ username: username2, password: password2 }),
    ),
  );

  it('installs the aws_elb module in the new db', install2(['aws_elb']));

  it(
    'saves the sql generated in the sql variable to be used in the new db in the next test',
    query(
      `
        SELECT * FROM iasql_get_sql_since('##timestamp##'::timestamp with time zone);
      `,
      (res: any) => {
        expect(res.length).toBe(2);
        sql = res.map((o: { sql: string }) => o.sql).join('\n');
      },
      false,
      () => ({ username, password }),
      () => ({ timestamp }),
    ),
  );

  it(
    'executes the generated sql to confirm it works',
    query2(
      `
        BEGIN;
          ##sql##
        COMMIT;
      `,
      undefined,
      true,
      () => ({ username: username2, password: password2 }),
      () => ({ sql }),
    ),
  );

  it(
    'checks load_balancer insertion',
    query2(
      `
        SELECT *
        FROM load_balancer
        WHERE load_balancer_name = '${lbName}';
      `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
