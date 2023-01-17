import * as iasql from '../../src/services/iasql';
import {
  defaultRegion,
  execComposeDown,
  execComposeUp,
  finish,
  getPrefix,
  runBegin,
  runCommit,
  runInstall,
  runQuery,
} from '../helpers';

const dbAlias = 'iasql';
const randIPBlock = Math.floor(Math.random() * 254) + 1; // 0 collides with the default CIDR block
jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

const begin = runBegin.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const region = defaultRegion();

const prefix = getPrefix();
let username: string, password: string;

describe('InternetGateway Integration Testing', () => {
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
          UPDATE aws_regions
          SET is_default = TRUE
          WHERE region = '${region}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it('installs the vpc module', install(['aws_vpc']));


  it('starts a transaction', begin());
  it(
    'creates a new vpc',
    query(
      `
          INSERT INTO vpc (cidr_block, tags, region)
          VALUES ('10.${randIPBlock}.0.0/16', '{"name":"${prefix}"}', '${region}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );

  it(
    'adds a subnet to the vpc',
    query(
      `
          INSERT INTO subnet (availability_zone, vpc_id, cidr_block, region)
          SELECT (SELECT name FROM availability_zone WHERE region = '${region}' ORDER BY 1 DESC LIMIT 1),
                 id,
                 '10.${randIPBlock}.1.0/24',
                 '${region}'
          FROM vpc
          WHERE tags ->> 'name' = '${prefix}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies creation of the vpc', commit());

  it('starts a transaction', begin());
  it(
    'adds a new internet gateway to the vpc in the region',
    query(
      `
          INSERT INTO internet_gateway (vpc_id, tags, region)
          VALUES ((SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}'), '{"name":"${prefix}"}',
                  '${region}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies creation of the internet gateway', commit());

  it(
    'confirms that the internet gateway is created',
    query(
      `
          SELECT *
          FROM internet_gateway
          WHERE tags ->> 'name' = '${prefix}'
      `,
      (res: any[]) => expect(res.length).toBe(1),
      true,
      () => ({ username, password }),
    ),
  );

  it('starts a transaction', begin());
  it(
    'creates another vpc',
    query(
      `
          INSERT INTO vpc (cidr_block, tags, region)
          VALUES ('10.${randIPBlock}.0.0/16', '{"name":"${prefix}-2"}', '${region}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies creation of the second vpc', commit());

  it(
    'verifies there is no internet gateway associated with the new vpc',
    query(
      `
      SELECT *
      FROM internet_gateway
      WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-2')
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());
  it(
    'associates the internet gateway with the new vpc',
    query(
      `
          UPDATE internet_gateway
          SET vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-2')
          WHERE internet_gateway.tags ->> 'name' = '${prefix}'
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies association of the internet gateway to the new vpc', commit());

  it(
    'checks the internet gateway is associated with the new vpc',
    query(
      `
      SELECT *
      FROM internet_gateway
      WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}-2');
  `,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it(
    'checks the first vpc does not have any internet gateways',
    query(
      `
      SELECT *
      FROM internet_gateway
      WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}')
  `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it('starts a transaction', begin());
  it(
    'deletes the internet gateway',
    query(
      `
          DELETE
          FROM internet_gateway
          WHERE tags ->> 'name' = '${prefix}'
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies deletion of the internet gateway', commit());

  it('starts a transaction', begin());
  it(
    'deletes the vpcs',
    query(
      `
          DELETE
          FROM vpc
          WHERE tags ->> 'name' IN ('${prefix}', '${prefix}-2')
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies deletion of the vpcs', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
