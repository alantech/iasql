import { v4 as uuidv4 } from 'uuid';

import * as Modules from '../../src/modules';
import { awsAccount, awsVpcModule, Context } from '../../src/modules';
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
  itDocs,
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

describe('RouteTable Integration Testing', () => {
  let context: Context;

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

  itDocs('installs the vpc module', install(['aws_vpc']));

  it('regions for vpc and route table should be the same', async () => {
    const associations = (await awsVpcModule.routeTableAssociation.db.read(
      context,
    )) as RouteTableAssociation[];
    for (const a of associations) expect(a.vpc.region).toBe(a.routeTable.region);
  });

  itDocs(
    'checks each vpc has at least a route table',
    query(
      `
      SELECT vpc.vpc_id, COUNT(rt) as rt_count
      FROM vpc
               LEFT JOIN route_table rt on vpc.id = rt.vpc_id
      GROUP BY vpc.vpc_id;
  `,
      (res: any[]) => {
        expect(res.length).toBeGreaterThan(0); // at least one VPC
        res.map(row => expect(parseInt(row.rt_count, 10)).toBeGreaterThanOrEqual(1));
      },
      true,
      () => ({ username, password }),
    ),
  );

  it('starts a transaction', begin());
  itDocs(
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

  itDocs(
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
  itDocs(
    'adds a new route table to the vpc in the region',
    query(
      `
          INSERT INTO route_table (vpc_id, tags, region)
          VALUES ((SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}'), '{"name":"${prefix}"}',
                  '${region}');
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies creation of the route table', commit());

  itDocs(
    'confirms that the default route is created',
    query(
      `
      SELECT *
      FROM route
      WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}')
  `,
      (res: any[]) => expect(res.length).toBe(1),
      true,
      () => ({ username, password }),
    ),
  );

  itDocs(
    'checks there is no association for the route table',
    query(
      `
      SELECT *
      FROM route_table_association
      WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}')
  `,
      (res: any[]) => {
        expect(res.length).toBe(0);
      },
    ),
  );
  it('starts a transaction', begin());
  itDocs(
    'associates the route table to the subnet',
    query(
      `
          INSERT INTO route_table_association (route_table_id, vpc_id, subnet_id)
          VALUES ((SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}'),
                  (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}'),
                  (SELECT id
                   FROM subnet
                   WHERE cidr_block = '10.${randIPBlock}.1.0/24'
                     AND availability_zone =
                         (SELECT name FROM availability_zone WHERE region = '${region}' ORDER BY 1 DESC LIMIT 1)));
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies creation of the route table', commit());
  itDocs(
    'checks whether the route table is associated to the subnet',
    query(
      `
      SELECT *
      FROM route_table_association
      WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}');
  `,
      (res: any[]) => {
        expect(res.length).toBe(1);
      },
    ),
  );

  it('starts a transaction', begin());
  itDocs(
    'deletes the association',
    query(
      `
      DELETE
      FROM route_table_association
      WHERE route_table_id = (SELECT id FROM route_table WHERE tags ->> 'name' = '${prefix}');
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  itDocs(
    'deletes the route table',
    query(
      `
      DELETE
      FROM route_table
      WHERE tags ->> 'name' = '${prefix}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  itDocs(
    'deletes the subnet and vpc',
    query(
      `
      DELETE
      FROM subnet
      WHERE vpc_id = (SELECT id FROM vpc WHERE tags ->> 'name' = '${prefix}');

      DELETE
      FROM vpc
      WHERE tags ->> 'name' = '${prefix}';
  `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies deletion of resources', commit());

  it('starts a transaction', begin());
  it(
    'tries to delete routes from default route table',
    query(
      `
        DELETE
        FROM route
        USING route_table
        WHERE route.region = '${region}'
          AND route_table.id IN (SELECT route_table_id FROM route_table_association WHERE is_main)
      `,
    ),
  );

  it('commits deletion of the routes', commit());

  it(
    'routes to the internet gateway from the default route table should still be there',
    query(
      `
        SELECT ig.internet_gateway_id as ig_id, route.region, route.route_table_id, rt.route_table_id
        FROM route
          JOIN route_table rt on rt.id = route.route_table_id
          JOIN vpc v on rt.vpc_id = v.id
          JOIN internet_gateway ig on v.id = ig.vpc_id
        WHERE v.is_default AND route.region = '${region}'
        GROUP BY route.route_table_id, route.region, ig.internet_gateway_id, rt.route_table_id
        HAVING ('0.0.0.0/0' <> ALL (array_agg(destination)));
               `,
      (res: any[]) => expect(res.length).toBe(0),
    ),
  );

  it(
    'rechecks the route table is still there',
    query(
      `
        SELECT * FROM route_table
        WHERE region = '${region}'
          AND route_table.id IN (SELECT route_table_id FROM route_table_association WHERE is_main)
      `,
      (res: any[]) => expect(res.length).toBeGreaterThan(0),
    ),
  );

  it(
    'checks the route from default route table in default vpc to internet gateway exists',
    query(
      `
      SELECT *
      FROM route
           JOIN route_table rt on route.route_table_id = rt.id
           JOIN vpc v on v.id = rt.vpc_id
           JOIN route_table_association rta on rt.id = rta.route_table_id
      WHERE route.gateway_id IS NOT NULL AND destination = '0.0.0.0/0' AND v.is_default AND rta.is_main AND v.region = '${region}'
`,
      (res: any[]) => expect(res.length).toBe(1),
    ),
  );

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
