import { EC2 } from '@aws-sdk/client-ec2';

import * as iasql from '../../src/services/iasql';
import {
  runQuery,
  finish,
  execComposeUp,
  execComposeDown,
  runInstall,
  runBegin,
  defaultRegion,
} from '../helpers';

const dbAlias = 'rollbacktest';
const sgName = 'rb-sg';
const amznAmiId = 'resolve:ssm:/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2';
let availabilityZone: string, instanceType: string;

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uid = '12345';
const email = 'test@example.com';
const region = defaultRegion();

jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

let username: string, password: string;

describe('rollback functionality', () => {
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

  it('installs the module', install(['aws_ec2']));

  it('starts a transaction', begin());

  it(
    'insert a log group',
    query(
      `
        INSERT INTO security_group (description, group_name)
        VALUES ('${sgName} security group', '${sgName}');

        INSERT INTO instance (ami, instance_type, tags, subnet_id)
          SELECT '${amznAmiId}', 'fake-instance-type', '{"name":"${dbAlias}"}', id
          FROM subnet
          WHERE availability_zone = (SELECT name FROM availability_zone WHERE region = '${region}' ORDER BY 1 DESC LIMIT 1)
          LIMIT 1;

        INSERT INTO instance_security_groups (instance_id, security_group_id) SELECT
          (SELECT id FROM instance WHERE tags ->> 'name' = '${dbAlias}'),
          (SELECT id FROM security_group WHERE group_name='${sgName}' AND region = '${region}');
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

  it('commit should fail and rollback', done =>
    void query(`
      SELECT * FROM iasql_commit();
    `)((e?: any) => {
      try {
        expect(e?.message).toContain('Another transaction is open');
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
        select * from instance where WHERE tags ->> 'name' = '${dbAlias}';
      `,
      (res: any) => {
        expect(res.length).toBe(0);
      },
    ),
  );

  it('confirm you can start a transaction', begin());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, uid).then(...finish(done)));
});
