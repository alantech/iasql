import { v4 as uuidv4 } from 'uuid';

import * as Modules from '../../src/modules';
import { awsAccount, awsVpcModule } from '../../src/modules';
import * as iasql from '../../src/services/iasql';
import { TypeormWrapper } from '../../src/services/typeorm';
import { execComposeDown, execComposeUp, finish, runCommit, runInstall, runQuery } from '../helpers';
import { getContext } from '../../src/router/db';

const dbAlias = 'routetabletest';
jest.setTimeout(360000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const commit = runCommit.bind(null, dbAlias);
const region = 'eu-central-1';

describe('RouteTable Functional Testing', () => {
  let context: { [x: string]: any };

  it('creates a new test db', done =>
    void iasql.connect(dbAlias, 'not-needed', 'not-needed').then(...finish(done)));

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
    ),
  );

  it('syncs the regions', commit());

  it(
    'sets the default region',
    query(`
        UPDATE aws_regions
        SET is_default = TRUE
        WHERE region = '${region}';
    `),
  );

  it('installs the vpc module', install(['aws_vpc']));

  it('tries calling cloud read', async () => {
    const out = await awsVpcModule.routeTable.cloud.read(context);
    console.log(out);
  });

  it('deletes the test db', done => void iasql.disconnect(dbAlias, 'not-needed').then(...finish(done)));
});
