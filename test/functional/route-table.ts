import { v4 as uuidv4 } from 'uuid';

import * as Modules from '../../src/modules';
import { awsAccount, awsVpcModule } from '../../src/modules';
import { RouteTableAssociation } from '../../src/modules/aws_vpc/entity';
import { getContext } from '../../src/router/db';
import * as iasql from '../../src/services/iasql';
import { TypeormWrapper } from '../../src/services/typeorm';
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


describe('RouteTable Functional Testing', () => {
  let context: { [x: string]: any };

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

  it('inits variables', async () => {
    const conn = await TypeormWrapper.createConn(dbAlias, { name: uuidv4() });
    const initialContext = await getContext(conn, Modules);
    context = { ...awsAccount.context, ...initialContext };
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

  it('regions for vpc and route table should be the same', async () => {
    const associations = (await awsVpcModule.routeTableAssociation.db.read(
      context,
    )) as RouteTableAssociation[];
    for (const a of associations) expect(a.vpc.region).toBe(a.routeTable.region);
  });


  it('checks each vpc has at least a route table', query(`
      SELECT vpc.vpc_id, COUNT(rt) as rt_count
      FROM vpc
               LEFT JOIN route_table rt on vpc.id = rt.vpc_id
      GROUP BY vpc.vpc_id;
  `, (res: any[]) => {
    expect(res.length).toBeGreaterThan(0); // at least one VPC
    res.map(row => expect(parseInt(row.rt_count, 10)).toBeGreaterThanOrEqual(1));
  }, true, () => ({ username, password })));

  it('starts a transaction', begin());
  it('creates a new vpc', query(`
      INSERT INTO vpc (cidr_block, tags, region)
      VALUES ('10.${randIPBlock}.0.0/16', '{"name":"${prefix}"}', '${region}');
  `, undefined, true, () => ({ username, password })));

  it('adds a subnet to the vpc', query(`
      INSERT INTO subnet (availability_zone, vpc_id, cidr_block, region)
      SELECT '${region}a', id, '10.${randIPBlock}.1.0/24', '${region}'
      FROM vpc
      WHERE tags ->> 'name' = '${prefix}';
  `, undefined, true, () => ({ username, password })));
  it('applies creation of the vpc', commit());

  it('starts a transaction', begin());
  it('adds a new route table to the vpc in the region', query(`
      INSERT INTO route_table (vpc_id, tags, region)
      VALUES ((SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}'), '{"name":"${prefix}"}',
              '${region}');
  `, undefined, true, () => ({ username, password })));
  it('applies creation of the route table', commit());

  it('confirms that the default route is created', query(`
      SELECT *
      FROM route
      WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}')
  `, (res: any[]) => expect(res.length).toBe(1), true, () => ({ username, password })));

  it('checks there is no association for the route table', query(`
      SELECT *
      FROM route_table_association
      WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}')
  `, (res: any[]) => {
    expect(res.length).toBe(0);
  }));
  it('starts a transaction', begin());
  it('associates the route table to the subnet', query(`
      INSERT INTO route_table_association (route_table_id, vpc_id, subnet_id)
      VALUES ((SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}'),
              (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}'),
              (SELECT id
               FROM subnet
               WHERE cidr_block = '10.${randIPBlock}.1.0/24'
                 AND availability_zone = '${region}a'));
  `, undefined, true, () => ({ username, password })));
  it('applies creation of the route table', commit());
  it('checks whether the route table is associated to the subnet', query(`
      SELECT *
      FROM route_table_association
      WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}');
  `, (res: any[]) => {
    expect(res.length).toBe(1);
  }));

  it('starts a transaction', begin());
  it('deletes the association', query(`
      DELETE
      FROM route_table_association
      WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}');
  `, undefined, true, () => ({ username, password })));
  it('deletes the route table', query(`
      DELETE
      FROM route_table
      WHERE tags ->> 'name' = '${prefix}';
  `));
  it('deletes the subnet and vpc', query(`
      DELETE
      FROM subnet
      WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}');

      DELETE
      FROM vpc
      WHERE tags ->> 'name' = '${prefix}';
  `));
  it('applies deletion of resources', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
