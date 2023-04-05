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
const region = defaultRegion();

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);

const lbName = `${dbAlias}lb`;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbType = LoadBalancerTypeEnum.APPLICATION;
const lbIPAddressType = IpAddressType.IPV4;

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

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

  itDocs('begin a transaction', begin());

  itDocs(
    'adds a new load balancer',
    query(
      `
        BEGIN;
          INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
          VALUES ('${lbName}', '${lbScheme}', null, '${lbType}', '${lbIPAddressType}');

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

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
