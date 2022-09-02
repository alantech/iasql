import config from "../../src/config";
import * as iasql from "../../src/services/iasql";
import {
  runQuery,
  runInstall,
  runUninstall,
  runApply,
  finish,
  execComposeUp,
  execComposeDown,
  runSync,
  getPrefix,
} from "../helpers";

const prefix = getPrefix();
const dbAlias = `${prefix}apigatewaytest`;

const apply = runApply.bind(null, dbAlias);
const sync = runSync.bind(null, dbAlias);
const query = runQuery.bind(null, dbAlias);
const install = runInstall.bind(null, dbAlias);
const uninstall = runUninstall.bind(null, dbAlias);
const modules = ["aws_api_gateway"];
const apiName = `${prefix}testApi`;

jest.setTimeout(3600000);
beforeAll(async () => await execComposeUp());
afterAll(async () => await execComposeDown());

describe("API Gateway Integration Testing", () => {
  it("creates a new test db", (done) =>
    void iasql
      .connect(dbAlias, "not-needed", "not-needed")
      .then(...finish(done)));

  it("installs the aws_account module", install(["aws_account"]));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = '${process.env.AWS_REGION}';
  `));

  it("installs the API gateway module", install(modules));

  it(
    "adds a new API gateway",
    query(`  
    INSERT INTO api (name, description)
    VALUES ('${apiName}', 'description');
  `)
  );

  it("undo changes", sync());

  it(
    "adds a new API gateway",
    query(`  
    INSERT INTO api (name, description, disable_execute_api_endpoint, version)
    VALUES ('${apiName}', 'description', false, '1.0');
  `)
  );

  it("applies the API gateway change", apply());

  it(
    "check API gateway is available",
    query(
      `
  SELECT * FROM api WHERE name='${apiName}';
  `,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "tries to update API description",
    query(`
  UPDATE api SET description='new description' WHERE name='${apiName}'
  `)
  );

  it("applies the API description update", apply());

  it(
    "checks that API has been been modified",
    query(
      `
  SELECT * FROM api WHERE description='new description' and name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "tries to update API ID",
    query(`
  UPDATE api SET api_id='fake' WHERE name='${apiName}'
  `)
  );

  it("applies the API ID update", apply());

  it(
    "checks that API ID has not been been modified",
    query(
      `
  SELECT * FROM api WHERE api_id='fake' AND name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(0)
    )
  );

  it(
    "tries to update the API protocol",
    query(`
  UPDATE api SET protocol_type='WEBSOCKET' WHERE name='${apiName}'
  `)
  );

  it("applies the API protocol update", apply());

  it(
    "checks that API protocol has not been been modified",
    query(
      `
  SELECT * FROM api WHERE protocol_type='HTTP' AND name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(1)
    )
  );
  it(
    "checks that API protocol has not been been modified",
    query(
      `
  SELECT * FROM api WHERE protocol_type='WEBSOCKET' AND name='${apiName}';
`,
      (res: any) => expect(res.length).toBe(0)
    )
  );

  it("uninstalls the API module", uninstall(modules));

  it(
    "installs the API module again (to make sure it reloads stuff)",
    install(modules)
  );

  it(
    "checks API count",
    query(
      `
    SELECT * FROM api WHERE name='${apiName}';
  `,
      (res: any) => expect(res.length).toBe(1)
    )
  );

  it(
    "deletes the API",
    query(`
    DELETE FROM api
    WHERE name = '${apiName}';
  `)
  );

  it("applies the API removal", apply());

  it("deletes the test db", (done) =>
    void iasql.disconnect(dbAlias, "not-needed").then(...finish(done)));
});

describe("API install/uninstall", () => {
  it("creates a new test db", (done) =>
    void iasql
      .connect(dbAlias, "not-needed", "not-needed")
      .then(...finish(done)));

  it("installs the aws_account module", install(["aws_account"]));

  it('inserts aws credentials', query(`
    INSERT INTO aws_credentials (access_key_id, secret_access_key)
    VALUES ('${process.env.AWS_ACCESS_KEY_ID}', '${process.env.AWS_SECRET_ACCESS_KEY}')
  `, undefined, false));

  it('syncs the regions', sync());

  it('sets the default region', query(`
    UPDATE aws_regions SET is_default = TRUE WHERE region = 'us-east-1';
  `));

  it("installs the API module", install(modules));

  it("uninstalls the API module", uninstall(modules));

  it("installs all modules", (done) =>
    void iasql
      .install([], dbAlias, config.db.user, true)
      .then(...finish(done)));

  it("uninstalls the API module", uninstall(["aws_api_gateway"]));

  it("installs the API module", install(["aws_api_gateway"]));

  it("deletes the test db", (done) =>
    void iasql.disconnect(dbAlias, "not-needed").then(...finish(done)));
});