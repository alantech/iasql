import {
  CreateGroupResponse,
  GetGroupResponse,
  ListGroupsResponse,
} from '@aws-sdk/client-iam/dist-types/models/models_0';

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

describe('AWS Integration Testing', () => {
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

  it('installs the aws sdk module', install(['aws_sdk']));

  it(
    'get IAM groups list',
    query(
      `
    SELECT invoke_iam('listGroups', '{}') as result;
  `,
      (res: { result: ListGroupsResponse }[]) => {
        expect(res[0].result).toHaveProperty('Groups');
        expect(res[0].result.Groups).toBeInstanceOf(Array);
      },
    ),
  );

  it(
    'creates an IAM group',
    query(
      `
    SELECT invoke_iam('createGroup', '{
      "GroupName": "${prefix}"
    }') as result;
  `,
      (res: { result: CreateGroupResponse }[]) => {
        expect(res[0].result).toHaveProperty('Group');
        expect(res[0].result.Group?.GroupName).toBe(prefix);
      },
    ),
  );

  it(
    'gets the created IAM group',
    query(
      `
    SELECT invoke_iam('getGroup', '{
      "GroupName": "${prefix}"
    }') as result;
  `,
      (res: { result: GetGroupResponse }[]) => {
        expect(res[0].result).toHaveProperty('Group');
        expect(res[0].result.Group?.GroupName).toBe(prefix);
        expect(res[0].result.Users?.length).toBe(0);
      },
    ),
  );

  it('installs vpc module', install(['aws_vpc']));
  //
  // it(
  //   'executes a request per each default vpc and checks vpc_id and cidr_block',
  //   query(
  //     `
  //     SELECT vpc_id,
  //            cidr_block,
  //            invoke_ec2('describeVpcs', json_build_object('VpcIds', array [vpc_id]), region) -> 'Vpcs' ->
  //            0 as cloud_data
  //     FROM vpc
  //     WHERE is_default
  // `,
  //     (res: { vpc_id: string; cidr_block: string; cloud_data: { VpcId: string; CidrBlock: string } }[]) => {
  //       for (const row of res) {
  //         expect(row.vpc_id).toBe(row.cloud_data.VpcId);
  //         expect(row.cidr_block).toBe(row.cloud_data.CidrBlock);
  //       }
  //     },
  //   ),
  // );

  it(
    'creates a route table',
    query(`
        SELECT invoke_ec2(
                       'createRouteTable',
                       json_build_object(
                               'VpcId',
                               (SELECT vpc_id FROM vpc WHERE region = default_aws_region() AND is_default LIMIT 1),
                               'TagSpecifications',
                               '[{"ResourceType": "route-table", "Tags": [{"Key": "Name", "Value": "${prefix}"}]}]'::json
                           )
                   )
    `),
  );

  it('starts a new transaction', begin());
  it('commits transaction to sync', commit());

  it(
    'checks the route table is created',
    query(
      `
          SELECT *
          FROM route_table
          WHERE tags ->> 'Name' = '${prefix}'
      `,
      (res: any[]) => {
        expect(res.length).toBe(1);
      },
    ),
  );

  it('starts a new transaction', begin());
  it(
    'deletes the route table',
    query(
      `
          DELETE
          FROM route_table
          WHERE tags ->> 'Name' = '${prefix}';
      `,
      undefined,
      true,
      () => ({ username, password }),
    ),
  );
  it('applies deletion of the route table', commit());

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
