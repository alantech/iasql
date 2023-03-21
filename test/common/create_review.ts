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

const dbAlias = 'createreview';
const region = defaultRegion();

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);

const lbName = `${dbAlias}lb`;
const lbScheme = LoadBalancerSchemeEnum.INTERNET_FACING;
const lbTypeApp = LoadBalancerTypeEnum.APPLICATION;
const lbIPAddressType = IpAddressType.IPV4;

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
          INSERT INTO load_balancer (load_balancer_name, scheme, vpc, load_balancer_type, ip_address_type)
          VALUES ('${lbName}', '${lbScheme}', null, '${lbTypeApp}', '${lbIPAddressType}');

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

  itDocs(
    'creates review markdown',
    query(`SELECT * FROM iasql_create_review('New ELB', 'Test new ELB');`, (res: any[]) => {
      expect(res.length).toBe(1);
      expect(res[0].markdown).toBe(`# New ELB

Test new ELB

## IaSQL Preview

| action | table_name | id | description |
| --- | --- | --- | --- |
| create | load_balancer | 1 | 1 |

## SQL changes

\`\`\`sql

          INSERT INTO load_balancer (load_balancer_name, scheme, load_balancer_type, ip_address_type, region)
          VALUES ('createreviewlb', 'internet-facing', 'application', 'ipv4', (SELECT region FROM aws_regions WHERE region = '${region}'));
        
\`\`\``);
    }),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
