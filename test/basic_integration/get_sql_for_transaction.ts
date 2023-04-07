import { EC2 } from '@aws-sdk/client-ec2';

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
  runRollback,
} from '../helpers';

const dbAlias = 'getsqlfortransaction';
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

let az1: string, az2: string, az3: string;

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const rollback = runRollback.bind(null, dbAlias);

const lbName = `${dbAlias}lb`;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbTypeApp = LoadBalancerTypeEnum.APPLICATION;
const lbTypeNet = LoadBalancerTypeEnum.NETWORK;
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
const lbUpdatedWDefaultAttributes = [
  { Key: 'access_logs.s3.prefix', Value: '' },
  { Key: 'deletion_protection.enabled', Value: 'false' },
  { Key: 'load_balancing.cross_zone.enabled', Value: 'false' },
  { Key: 'access_logs.s3.enabled', Value: 'false' },
  { Key: 'access_logs.s3.bucket', Value: '' },
];

jest.setTimeout(360000);
beforeAll(async () => {
  const azs = (await getAvailabilityZones())?.AvailabilityZones?.map(az => az.ZoneName)?.sort() ?? [];
  az1 = azs[0] ?? '';
  az2 = azs[1] ?? '';
  az3 = azs[2] ?? '';
  await execComposeUp();
});
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
          VALUES ('${lbName}', '${lbScheme}', null, '${lbTypeApp}', '${lbIPAddressType}', '${JSON.stringify(
        lbInitDefaultAttributes,
      )}', (SELECT array_agg(az.name) FROM (SELECT name from availability_zone WHERE region = '${region}' GROUP BY name ORDER BY name ASC LIMIT 2) as az));

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

  it('rollback insert changes', rollback());

  it(
    'checks load_balancer insertion',
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
    'check load_balancer_security_groups insertion',
    query(
      `
        SELECT *
        FROM load_balancer_security_groups
        WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  itDocs(
    'check sql for transaction',
    query(
      `
        SELECT *
        FROM iasql_get_sql_for_transaction();
      `,
      (res: any) => {
        expect(res.length).toBe(2);
        expect(res[0].sql.replaceAll('\n', '').replaceAll(/\s\s+/g, ' ').trim()).toBe(
          `INSERT INTO load_balancer (load_balancer_name, scheme, load_balancer_type, availability_zones, ip_address_type, region, attributes) VALUES ('${lbName}', '${lbScheme}', '${lbTypeApp}', array['${az1}','${az2}']::varchar[], '${lbIPAddressType}', (SELECT region FROM aws_regions WHERE region = '${region}'), '${JSON.stringify(
            lbInitDefaultAttributes,
          )}'::jsonb);`,
        );
        expect(res[1].sql).toContain(`INSERT INTO load_balancer_security_groups (`);
      },
    ),
  );

  it(
    'executes the INSERT sql generated to confirm it works',
    query(
      `
        DO $$
          <<exec>>
          DECLARE
            stmt record;
          BEGIN
            FOR stmt IN
              SELECT *
              FROM iasql_get_sql_for_transaction()
            LOOP
              EXECUTE format('%s', stmt.sql);
            END LOOP;
        END exec $$;
      `,
      (res: any) => expect(res.length).toBe(0),
      true,
      () => ({ username, password }),
    ),
  );

  it('begin a transaction', begin());

  it('commits the insertion', commit());

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

  itDocs('begin a transaction', begin());

  itDocs(
    'Updates the load balancer',
    query(
      `
        UPDATE load_balancer
        SET load_balancer_type = '${lbTypeNet}', attributes = '${JSON.stringify(
        lbUpdatedWDefaultAttributes,
      )}', availability_zones = (SELECT array_agg(az.name) FROM (SELECT name from availability_zone WHERE region = '${region}' GROUP BY name ORDER BY name ASC LIMIT 3) as az)
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

  it('rollback update changes', rollback());

  itDocs(
    'check sql for transaction',
    query(
      `
        SELECT *
        FROM iasql_get_sql_for_transaction();
      `,
      (res: any) => {
        expect(res.length).toBe(1);
        const sql = res[0].sql.replaceAll('\n', '').replaceAll(/\s\s+/g, ' ').trim();
        expect(sql).toContain(`load_balancer_type = '${lbTypeNet}'`);
        expect(sql).toContain(`load_balancer_type = '${lbTypeApp}'`);
        expect(sql).toContain(`availability_zones = array['${az1}','${az2}','${az3}']::varchar[]`);
        expect(sql).toContain(`attributes = '${JSON.stringify(lbUpdatedWDefaultAttributes)}'::jsonb`);
        expect(sql).toContain(`attributes::jsonb = '${JSON.stringify(lbInitDefaultAttributes)}'::jsonb`);
      },
    ),
  );

  it(
    'executes the UPDATE sql generated to confirm it works',
    query(
      `
        DO $$
          <<exec>>
          DECLARE
            stmt record;
          BEGIN
            FOR stmt IN
              SELECT *
              FROM iasql_get_sql_for_transaction()
            LOOP
              EXECUTE format('%s', stmt.sql);
            END LOOP;
        END exec $$;
      `,
      (res: any) => expect(res.length).toBe(0),
      true,
      () => ({ username, password }),
    ),
  );

  it('begin a transaction', begin());

  it('commits the insertion', commit());

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

  itDocs('begin a transaction', begin());

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

  it('rollback delete changes', rollback());

  itDocs(
    'check sql for transaction',
    query(
      `
        SELECT *
        FROM iasql_get_sql_for_transaction();
      `,
      (res: any) => {
        expect(res.length).toBe(1);
        const sql = res[0].sql.replaceAll('\n', '').replaceAll(/\s\s+/g, ' ').trim();
        expect(sql).toContain(`load_balancer_name = '${lbName}'`);
        expect(sql).toContain(`load_balancer_type = '${lbTypeNet}'`);
        expect(sql).toContain(`scheme = '${lbScheme}'`);
        expect(sql).toContain(`ip_address_type = '${lbIPAddressType}'`);
        expect(sql).toContain(`attributes::jsonb = '${JSON.stringify(lbUpdatedWDefaultAttributes)}'::jsonb`);
      },
    ),
  );

  it(
    'executes the DELETE sql generated to confirm it works',
    query(
      `
        DO $$
          <<exec>>
          DECLARE
            stmt record;
          BEGIN
            FOR stmt IN
              SELECT *
              FROM iasql_get_sql_for_transaction()
            LOOP
              EXECUTE format('%s', stmt.sql);
            END LOOP;
        END exec $$;
      `,
      (res: any) => expect(res.length).toBe(0),
      true,
      () => ({ username, password }),
    ),
  );

  it('begin a transaction', begin());

  it('commits the insertion', commit());

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

  it(
    'check load_balancer_security_groups insertion',
    query(
      `
        SELECT *
        FROM load_balancer_security_groups
        WHERE load_balancer_id = (SELECT id FROM load_balancer WHERE load_balancer_name = '${lbName}');
      `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
