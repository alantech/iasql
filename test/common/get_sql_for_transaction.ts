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
  runCommit,
} from '../helpers';

const dbAlias = 'getsqlfortransaction';
const region = defaultRegion();

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);

const lbName = `${dbAlias}lb`;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbTypeApp = LoadBalancerTypeEnum.APPLICATION;
const lbTypeNet = LoadBalancerTypeEnum.NETWORK;
const lbIPAddressType = IpAddressType.IPV4;
const lbAttributes = { "idle_timeout": 60 };
const lbAttributesUpdated = { "idle_timeout": 60, "deletion_protection.enabled": true };

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('iasql_get_sql_for_transaction functionality', () => {
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

  itDocs('installs the aws_elb module', install(['aws_elb']));

  itDocs('begin a transaction', begin());

  itDocs(
    'adds a new load balancer',
    query(
      `
        BEGIN;
          INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type, attributes, availability_zones)
          VALUES ('${lbName}', '${lbScheme}', null, '${lbTypeApp}', '${lbIPAddressType}', '${JSON.stringify(lbAttributes)}', (SELECT array_agg(name) FROM availability_zone WHERE region = '${region}' GROUP BY name ORDER BY name DESC LIMIT 1));

          INSERT INTO load_balancer_security_groups(load_balancer_id, security_group_id)
            SELECT (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}' LIMIT 1),
            (SELECT id FROM security_group WHERE group_name = 'default' AND region = '${region}' LIMIT 1);
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

  itDocs('preview changes done so far', query(`SELECT * FROM iasql_preview();`));

  itDocs(
    'check sql for transaction',
    query(
      `
        SELECT *
        FROM iasql_get_sql_for_transaction(
          (
            SELECT transaction_id
            FROM iasql_audit_log
            WHERE change_type = 'OPEN_TRANSACTION'
            ORDER BY ts DESC
            LIMIT 1
          )
        );
      `,
      (res: any) => {
        expect(res.length).toBe(2);
        expect(res[0].sql.replaceAll('\n', '').replaceAll(/\s\s+/g, ' ').trim()).toBe(
          `INSERT INTO load_balancer (load_balancer_name, scheme, load_balancer_type, availability_zones, ip_address_type, region, attributes) VALUES ('${lbName}', '${lbScheme}', '${lbTypeApp}', (SELECT array_agg(name) FROM availability_zone WHERE region = '${region}' GROUP BY name ORDER BY name DESC LIMIT 1)::varchar[], '${lbIPAddressType}', (SELECT region FROM aws_regions WHERE region = '${region}'), '${JSON.stringify(lbAttributes)}'::jsonb);`,
        );
        expect(res[1].sql).toContain(`INSERT INTO load_balancer_security_groups (`);
      },
    ),
  );

  itDocs(
    'Updates the load balancer',
    query(
      `
        UPDATE load_balancer
        SET load_balancer_type = '${lbTypeNet}', attributes = '${JSON.stringify(lbAttributesUpdated)}', availability_zones = (SELECT array_agg(name) FROM availability_zone WHERE region = '${region}' GROUP BY name ORDER BY name DESC LIMIT 2)
        WHERE load_balancer_name = '${lbName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'checks load_balancer type update',
    query(
      `
        SELECT *
        FROM load_balancer
        WHERE load_balancer_name = '${lbName}' AND load_balancer_type = '${lbTypeNet}';
      `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks load_balancer type update',
    query(
      `
        SELECT *
        FROM load_balancer
        WHERE load_balancer_name = '${lbName}' AND load_balancer_type = '${lbTypeApp}';
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  itDocs('preview changes done so far', query(`SELECT * FROM iasql_preview();`));

  itDocs(
    'check sql for transaction',
    query(
      `
        SELECT *
        FROM iasql_get_sql_for_transaction(
          (
            SELECT transaction_id
            FROM iasql_audit_log
            WHERE change_type = 'OPEN_TRANSACTION'
            ORDER BY ts DESC
            LIMIT 1
          )
        );
      `,
      (res: any) => {
        expect(res.length).toBe(3);
        expect(res[2].sql.replaceAll('\n', '').replaceAll(/\s\s+/g, ' ').trim()).toBe(
          `UPDATE load_balancer SET load_balancer_name = '${lbName}', load_balancer_arn = NULL, dns_name = NULL, canonical_hosted_zone_id = NULL, created_time = NULL, scheme = '${lbScheme}', state = NULL, load_balancer_type = '${lbTypeNet}', subnets = NULL, availability_zones = NULL, ip_address_type = '${lbIPAddressType}', customer_owned_ipv4_pool = NULL, region = (SELECT region FROM aws_regions WHERE region = '${region}'), attributes = NULL, vpc = NULL WHERE load_balancer_name = '${lbName}' AND scheme = '${lbScheme}' AND load_balancer_type = '${lbTypeApp}' AND ip_address_type = '${lbIPAddressType}' AND region = (SELECT region FROM aws_regions WHERE region = '${region}');`,
        );
      },
    ),
  );

  itDocs(
    'Deletes the load balancer',
    query(
      `
        DELETE FROM load_balancer
        WHERE load_balancer_name = '${lbName}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'checks load_balancer deletion',
    query(
      `
        SELECT *
        FROM load_balancer
        WHERE load_balancer_name = '${lbName}';
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  itDocs('preview changes done so far', query(`SELECT * FROM iasql_preview();`));

  itDocs(
    'check sql for transaction',
    query(
      `
        SELECT *
        FROM iasql_get_sql_for_transaction(
          (
            SELECT transaction_id
            FROM iasql_audit_log
            WHERE change_type = 'OPEN_TRANSACTION'
            ORDER BY ts DESC
            LIMIT 1
          )
        );
      `,
      (res: any) => {
        expect(res.length).toBe(5);
        expect(res[3].sql.replaceAll('\n', '').replaceAll(/\s\s+/g, ' ').trim()).toBe(
          `DELETE FROM load_balancer WHERE load_balancer_name = '${lbName}' AND scheme = '${lbScheme}' AND load_balancer_type = '${lbTypeNet}' AND ip_address_type = '${lbIPAddressType}' AND region = (SELECT region FROM aws_regions WHERE region = '${region}');`,
        );
        expect(res[4].sql).toContain(`DELETE FROM load_balancer_security_groups`);
      },
    ),
  );

  itDocs(
    'check sql for latest transaction',
    query(
      `
        SELECT *
        FROM iasql_get_sql_for_transaction();
      `,
      (res: any) => expect(res.length).toBe(5),
    ),
  );

  it(
    'executes the sql generated to confirm it works',
    query(
      `
        DO $$
          <<exec>>
          DECLARE
            stmt record;
          BEGIN
            FOR stmt IN
              SELECT * FROM iasql_get_sql_for_transaction()
            LOOP
              execute format('%s', stmt.sql);
            END LOOP;
        END exec $$;
      `,
      (res: any) => {
        console.log(`+-+ res: ${JSON.stringify(res, null, 2)}`);
        expect(res).toBeUndefined();
      },
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
